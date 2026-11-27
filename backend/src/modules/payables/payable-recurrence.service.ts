import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { addDays, formatDay, toDay } from '../../common/recurrence/date-only';
import {
  firstOccurrence,
  nextToMake,
  type RecurrenceRule,
  shiftOffNonWorkingDays,
  yearsBetween,
} from '../../common/recurrence/recurrence';
import { notInVersionWorkspace } from '../../common/workspaces/version-workspaces';
import type { CreatePayableBody, UpdatePayableBody } from '../../contracts';
import { Payable, PayableSource, PayableStatus } from '../../entities/payable.entity';
import { Workspace } from '../../entities/workspace.entity';
import { PublicHolidaysService } from '../reference-data/public-holidays.service';
import { lockSeries } from './series-lock';

/** A repeating bill shows up this many days before it is due, or earlier if its reminder does. */
export const UPCOMING_WINDOW_DAYS = 14;
/**
 * A bound on one run for one series. Nothing is made before today, so a run
 * makes at most what falls in the window (a daily rule: about 15); this only
 * stops a loop on a corrupt rule.
 */
const MAX_CREATED_PER_RUN = 31;
const DEFAULT_REMIND_DAYS = 3;

type RecurrenceColumns = Pick<
  Payable,
  'recurrence' | 'seriesId' | 'occurrenceDate' | 'baseAmount' | 'skippedAt' | 'remindDaysBefore'
> &
  Partial<Pick<Payable, 'id' | 'isRecurring' | 'dueDate'>>;

/** The rule as stored: only the fields its frequency reads. */
export function normalizeRule(rule: RecurrenceRule): RecurrenceRule {
  const byMonth = rule.frequency === 'monthly' || rule.frequency === 'yearly';
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    startDate: rule.startDate,
    ...(byMonth && rule.nthWeekday ? { nthWeekday: rule.nthWeekday } : {}),
    ...(byMonth && !rule.nthWeekday && rule.monthDay !== undefined
      ? { monthDay: rule.monthDay }
      : {}),
    ...(rule.shift && rule.shift !== 'none' ? { shift: rule.shift } : {}),
    ...(rule.until ? { until: rule.until } : {}),
    ...(rule.count ? { count: rule.count } : {}),
  };
}

/**
 * Repeating bills. Every occurrence is a bill of its own that shares the
 * series id and the rule; the next one is made from the newest when that one
 * is settled (paid, skipped, withdrawn) or when the next date comes within
 * the upcoming window. One row per series and occurrence day (a unique index)
 * makes making it idempotent: two runs at once create it once.
 */
@Injectable()
export class PayableRecurrenceService {
  private readonly logger = new Logger(PayableRecurrenceService.name);

  constructor(
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @Optional()
    private readonly publicHolidays?: PublicHolidaysService,
  ) {}

  /** The recurrence columns of a new bill; a repeating one is due on its rule's first date. */
  async fieldsForCreate(workspaceId: string, dto: CreatePayableBody): Promise<RecurrenceColumns> {
    const base: RecurrenceColumns = {
      recurrence: null,
      seriesId: null,
      occurrenceDate: null,
      baseAmount: null,
      skippedAt: null,
      remindDaysBefore: dto.remindDaysBefore ?? DEFAULT_REMIND_DAYS,
    };
    if (!dto.recurrence) return base;
    const rule = normalizeRule(dto.recurrence);
    const first = this.firstOf(rule);
    const id = randomUUID();
    return {
      ...base,
      id,
      isRecurring: true,
      recurrence: rule,
      seriesId: id,
      occurrenceDate: first,
      dueDate: (await this.dueDateOf(workspaceId, rule, first)) as unknown as Date,
    };
  }

  /**
   * A changed rule on a bill being edited. A bill that did not repeat starts a
   * series on its due date; null ends the whole series, as "stop repeating"
   * does: there is one way a series ends. A new rule and the reminder days
   * carry to the occurrences already made after this one, deleted ones too, so
   * the newest occurrence always holds the rule the job goes on with.
   * A new amount typed into the form becomes the series amount again, over
   * one set for this occurrence alone. Saves the bill: the rule, the
   * occurrences after it and the bill itself change under the series lock.
   */
  async applyUpdate(payable: Payable, dto: UpdatePayableBody): Promise<Payable> {
    // A loan's bills repeat as its schedule does: the terms own the rule.
    if (payable.loanWalletId && dto.recurrence !== undefined) {
      throw new BadRequestException(appError('PAYABLE_LOAN_MANAGED'));
    }
    if (dto.amount != null && (payable.baseAmount != null || payable.loanWalletId)) {
      // The edit is already on the entity: what is stored says whether the amount changed.
      const [stored]: Array<{ amount: string }> = await this.payableRepository.query(
        'SELECT "amount" FROM "payables" WHERE "id" = $1 AND "workspace_id" = $2',
        [payable.id, payable.workspaceId],
      );
      // A loan's amounts come from its schedule: one typed in is this bill's own.
      if (stored && Number(stored.amount) !== Number(dto.amount)) {
        payable.baseAmount = payable.loanWalletId ? (payable.baseAmount ?? stored.amount) : null;
      }
    }
    const ruleChanged = dto.recurrence !== undefined;
    if (ruleChanged) {
      payable.recurrence = dto.recurrence ? normalizeRule(dto.recurrence) : null;
      payable.isRecurring = Boolean(payable.recurrence);
      if (payable.recurrence && !payable.seriesId) {
        const first = this.firstOf(payable.recurrence);
        payable.seriesId = payable.id;
        payable.occurrenceDate = payable.dueDate ? toDay(payable.dueDate) : first;
        payable.dueDate ??= (await this.dueDateOf(
          payable.workspaceId,
          payable.recurrence,
          first,
        )) as unknown as Date;
      }
    }
    return this.payableRepository.manager.transaction(async manager => {
      const { seriesId, occurrenceDate } = payable;
      if (seriesId) await lockSeries(manager, payable.workspaceId, seriesId);
      if (seriesId && occurrenceDate && ruleChanged && !payable.recurrence) {
        await this.stopSeries(payable.workspaceId, seriesId, manager);
      }
      if (seriesId && occurrenceDate && (ruleChanged || dto.remindDaysBefore != null)) {
        await manager.query(
          `UPDATE "payables"
              SET "recurrence" = CASE WHEN $5 THEN $1::jsonb ELSE "recurrence" END,
                  "is_recurring" = CASE WHEN $5 THEN $1::jsonb IS NOT NULL ELSE "is_recurring" END,
                  "remind_days_before" = COALESCE($6, "remind_days_before")
            WHERE "workspace_id" = $2 AND "series_id" = $3 AND "occurrence_date" > $4
              AND "id" <> $7`,
          [
            payable.recurrence ? JSON.stringify(payable.recurrence) : null,
            payable.workspaceId,
            seriesId,
            occurrenceDate,
            ruleChanged,
            dto.remindDaysBefore ?? null,
            payable.id,
          ],
        );
      }
      return manager.getRepository(Payable).save(payable);
    });
  }

  /** Daily: every live series across workspaces gets the occurrences now due to exist. */
  async generateDue(today = formatDay(new Date())): Promise<number> {
    // A series goes on while its newest occurrence, deleted or not, holds the rule.
    const series: Array<{ workspace_id: string; series_id: string }> =
      await this.payableRepository.query(
        `SELECT newest."workspace_id", newest."series_id"
           FROM (
             SELECT DISTINCT ON (p."workspace_id", p."series_id") p."workspace_id", p."series_id",
                    p."recurrence"
               FROM "payables" p
              WHERE p."series_id" IS NOT NULL AND ${notInVersionWorkspace('p."workspace_id"')}
              ORDER BY p."workspace_id", p."series_id", p."occurrence_date" DESC
           ) newest
          WHERE newest."recurrence" IS NOT NULL`,
      );
    let created = 0;
    for (const row of series) {
      try {
        created += await this.ensureSeries(row.workspace_id, row.series_id, today);
      } catch (error) {
        this.logger.error(
          `Failed to extend payable series ${row.series_id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return created;
  }

  /** `ensureSeries` for the bill with this id, looked up in its workspace; deleted ones too. */
  async ensureSeriesFor(workspaceId: string, payableId: string): Promise<number> {
    const payable = await this.payableRepository.findOne({
      where: { id: payableId, workspaceId },
      select: { id: true, workspaceId: true, seriesId: true },
      withDeleted: true,
    });
    return payable ? this.ensureSeriesOf(payable) : 0;
  }

  /** `ensureSeries` for the series of this bill, if it has one. */
  async ensureSeriesOf(payable: Pick<Payable, 'workspaceId' | 'seriesId'>): Promise<number> {
    return payable.seriesId ? this.ensureSeries(payable.workspaceId, payable.seriesId) : 0;
  }

  /**
   * Makes the occurrences of one series that are due to exist: after the
   * newest (deleted ones count, so a removed occurrence is never made again),
   * while the newest is settled (paid, skipped, archived or deleted: only that
   * payment is gone) or the next due date is within its window. Never one
   * before today: the grid's dates already past are passed over (they still
   * count towards the rule's `count`), so a series left alone for months makes
   * one occurrence, not a run of overdue ones; a series the upgrade made from
   * an old flag gets the one it missed, once (`catchUpOnce`). A series ends
   * only when its rule is cleared ("stop repeating", or "does not repeat" in the
   * form), which clears it on every occurrence. Returns how many it made.
   */
  async ensureSeries(
    workspaceId: string,
    seriesId: string,
    today = formatDay(new Date()),
  ): Promise<number> {
    let created = 0;
    let conflictAt: string | null = null;
    for (let attempt = 0; attempt < MAX_CREATED_PER_RUN; attempt += 1) {
      const step = await this.payableRepository.manager.transaction(manager =>
        this.makeNext(manager, workspaceId, seriesId, today),
      );
      if (step.kind === 'done') break;
      if (step.kind === 'conflict') {
        // Another run made it first: look again from the newest, unless nothing moved.
        if (conflictAt === step.newestId) break;
        conflictAt = step.newestId;
        continue;
      }
      created += 1;
    }
    return created;
  }

  /**
   * One step of `ensureSeries`, in a transaction holding the series lock
   * (`lockSeries`): a stop or a rule edit either waits for this step and
   * reaches the occurrence made here too, or this step waits for it and reads
   * the rule it left.
   */
  private async makeNext(
    manager: EntityManager,
    workspaceId: string,
    seriesId: string,
    today: string,
  ): Promise<{ kind: 'done' | 'made' } | { kind: 'conflict'; newestId: string }> {
    await lockSeries(manager, workspaceId, seriesId);
    const payables = manager.getRepository(Payable);
    const newest = await payables.findOne({
      where: { workspaceId, seriesId },
      order: { occurrenceDate: 'DESC' },
      withDeleted: true,
    });
    // A series ends only when its rule is cleared, which clears it on every occurrence.
    const rule = newest?.recurrence;
    if (!(newest?.occurrenceDate && rule)) return { kind: 'done' };
    // A deleted newest one gives the day to go on from; the amount and the rest come
    // from the newest live one (none left: the deleted one's own).
    const template = newest.deletedAt
      ? ((await payables.findOne({
          where: { workspaceId, seriesId },
          order: { occurrenceDate: 'DESC' },
        })) ?? newest)
      : newest;
    const next = nextToMake(rule, toDay(newest.occurrenceDate), today, newest.catchUpOnce);
    if (!next) return { kind: 'done' };
    const settled =
      Boolean(newest.deletedAt) ||
      newest.status === PayableStatus.PAID ||
      newest.status === PayableStatus.ARCHIVED;
    // Gated on the day it is due, the one its reminder counts back from.
    const dueDate = shiftOffNonWorkingDays(
      next,
      rule.shift,
      await this.holidaysFor(workspaceId, rule, next),
    );
    const window = Math.max(UPCOMING_WINDOW_DAYS, template.remindDaysBefore ?? 0);
    if (!settled && dueDate > addDays(today, window)) return { kind: 'done' };
    const inserted = await payables
      .createQueryBuilder()
      .insert()
      .into(Payable)
      .values({
        workspaceId,
        createdById: template.createdById,
        direction: template.direction,
        vendor: template.vendor,
        amount: Number(template.baseAmount ?? template.amount),
        currency: template.currency,
        dueDate: dueDate as unknown as Date,
        // The one an upgraded series missed, if its shifted day has passed too, is owed
        // already: no overdue notice. Any other is to pay, noticed as usual if it is late.
        status: next < today && dueDate < today ? PayableStatus.OVERDUE : PayableStatus.TO_PAY,
        source: PayableSource.MANUAL,
        isRecurring: true,
        recurrence: rule,
        seriesId,
        occurrenceDate: next,
        remindDaysBefore: template.remindDaysBefore,
        comment: template.comment,
        loanWalletId: template.loanWalletId,
      })
      .orIgnore()
      .returning(['id'])
      .execute();
    const newId = (inserted.raw as Array<{ id: string }>)[0]?.id;
    if (!newId) return { kind: 'conflict', newestId: newest.id };
    // The same workspace tags as the bill it was made from.
    await manager.query(
      `INSERT INTO "payable_tags" ("payable_id", "tag_id")
       SELECT $1, "tag_id" FROM "payable_tags" WHERE "payable_id" = $2
       ON CONFLICT DO NOTHING`,
      [newId, template.id],
    );
    return { kind: 'made' };
  }

  /**
   * Ends a series: no occurrence of it carries the rule any more, live or
   * deleted, so neither the daily job nor a restored backup goes on with it.
   * In the caller's transaction, which holds the series lock (`lockSeries`).
   */
  async stopSeries(workspaceId: string, seriesId: string, manager: EntityManager): Promise<void> {
    await manager.query(
      `UPDATE "payables" SET "recurrence" = NULL, "is_recurring" = false
        WHERE "workspace_id" = $1 AND "series_id" = $2`,
      [workspaceId, seriesId],
    );
  }

  private firstOf(rule: RecurrenceRule): string {
    const first = firstOccurrence(rule);
    if (!first) throw new BadRequestException(appError('PAYABLE_RECURRENCE_NEVER_FIRES'));
    return first;
  }

  /** The occurrence's due date: moved off weekends and the workspace country's holidays. */
  async dueDateOf(workspaceId: string, rule: RecurrenceRule, day: string): Promise<string> {
    return shiftOffNonWorkingDays(day, rule.shift, await this.holidaysFor(workspaceId, rule, day));
  }

  /** Holidays of the workspace's tax country around `day`; none when the rule does not shift. */
  private async holidaysFor(
    workspaceId: string,
    rule: RecurrenceRule,
    day: string,
  ): Promise<Set<string>> {
    if (!(rule.shift && rule.shift !== 'none' && this.publicHolidays)) return new Set();
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    const country = workspace?.taxJurisdiction?.code;
    if (!country) return new Set();
    // A shift can cross into the neighbouring year.
    return this.publicHolidays.holidaysFor(
      country,
      yearsBetween(addDays(day, -14), addDays(day, 14)),
    );
  }
}
