import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { addDays, formatDay, toDay } from '../../common/recurrence/date-only';
import {
  firstOccurrence,
  nextOccurrence,
  type RecurrenceRule,
  shiftOffNonWorkingDays,
  yearsBetween,
} from '../../common/recurrence/recurrence';
import { notInVersionWorkspace } from '../../common/workspaces/version-workspaces';
import type { CreatePayableBody, UpdatePayableBody } from '../../contracts';
import { Payable, PayableSource, PayableStatus } from '../../entities/payable.entity';
import { Workspace } from '../../entities/workspace.entity';
import { PublicHolidaysService } from '../reference-data/public-holidays.service';

/** A repeating bill shows up this many days before it is due, or earlier if its reminder does. */
export const UPCOMING_WINDOW_DAYS = 14;
/** At most this many occurrences of one series per run: a stale daily rule catches up over days. */
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
   * series on its due date; null ends the series. The rule and the reminder
   * days carry to the occurrences already made after this one, so ending the
   * series here is not undone by a later copy that still has the old rule.
   */
  async applyUpdate(payable: Payable, dto: UpdatePayableBody): Promise<void> {
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
    if (!(payable.seriesId && payable.occurrenceDate)) return;
    if (!ruleChanged && dto.remindDaysBefore == null) return;
    await this.payableRepository.query(
      `UPDATE "payables"
          SET "recurrence" = CASE WHEN $5 THEN $1::jsonb ELSE "recurrence" END,
              "is_recurring" = CASE WHEN $5 THEN $1::jsonb IS NOT NULL ELSE "is_recurring" END,
              "remind_days_before" = COALESCE($6, "remind_days_before")
        WHERE "workspace_id" = $2 AND "series_id" = $3 AND "occurrence_date" > $4
          AND "id" <> $7 AND "deleted_at" IS NULL`,
      [
        payable.recurrence ? JSON.stringify(payable.recurrence) : null,
        payable.workspaceId,
        payable.seriesId,
        payable.occurrenceDate,
        ruleChanged,
        dto.remindDaysBefore ?? null,
        payable.id,
      ],
    );
  }

  /** Daily: every live series across workspaces gets the occurrences now due to exist. */
  async generateDue(today = formatDay(new Date())): Promise<number> {
    const series: Array<{ workspace_id: string; series_id: string }> =
      await this.payableRepository.query(
        `SELECT newest."workspace_id", newest."series_id"
           FROM (
             SELECT DISTINCT ON (p."workspace_id", p."series_id") p."workspace_id", p."series_id",
                    p."deleted_at", p."recurrence"
               FROM "payables" p
              WHERE p."series_id" IS NOT NULL AND ${notInVersionWorkspace('p."workspace_id"')}
              ORDER BY p."workspace_id", p."series_id", p."occurrence_date" DESC
           ) newest
          WHERE newest."deleted_at" IS NULL AND newest."recurrence" IS NOT NULL`,
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

  /** `ensureSeries` for the bill with this id, looked up in its workspace. */
  async ensureSeriesFor(workspaceId: string, payableId: string): Promise<number> {
    const payable = await this.payableRepository.findOne({
      where: { id: payableId, workspaceId },
      select: { id: true, workspaceId: true, seriesId: true },
    });
    return payable ? this.ensureSeriesOf(payable) : 0;
  }

  /** `ensureSeries` for the series of this bill, if it has one. */
  async ensureSeriesOf(payable: Pick<Payable, 'workspaceId' | 'seriesId'>): Promise<number> {
    return payable.seriesId ? this.ensureSeries(payable.workspaceId, payable.seriesId) : 0;
  }

  /**
   * Makes the occurrences of one series that are due to exist: after the
   * newest (deleted ones count, so a removed occurrence is never made again,
   * and a deleted newest one stops the series), while the newest is settled or
   * the next date is within its window. Returns how many it made.
   */
  async ensureSeries(
    workspaceId: string,
    seriesId: string,
    today = formatDay(new Date()),
    manager: EntityManager = this.payableRepository.manager,
  ): Promise<number> {
    const payables = manager.getRepository(Payable);
    let created = 0;
    let conflictAt: string | null = null;
    for (let attempt = 0; attempt < MAX_CREATED_PER_RUN; attempt += 1) {
      const newest = await payables.findOne({
        where: { workspaceId, seriesId },
        order: { occurrenceDate: 'DESC' },
        withDeleted: true,
      });
      const rule = newest?.recurrence;
      if (!(newest && rule && newest.occurrenceDate) || newest.deletedAt) break;
      const next = nextOccurrence(rule, toDay(newest.occurrenceDate));
      if (!next) break;
      const settled =
        newest.status === PayableStatus.PAID || newest.status === PayableStatus.ARCHIVED;
      const window = Math.max(UPCOMING_WINDOW_DAYS, newest.remindDaysBefore ?? 0);
      if (!settled && next > addDays(today, window)) break;
      const holidays = await this.holidaysFor(workspaceId, rule, next);
      const inserted = await payables
        .createQueryBuilder()
        .insert()
        .into(Payable)
        .values({
          workspaceId,
          createdById: newest.createdById,
          direction: newest.direction,
          vendor: newest.vendor,
          amount: Number(newest.baseAmount ?? newest.amount),
          currency: newest.currency,
          dueDate: shiftOffNonWorkingDays(next, rule.shift, holidays) as unknown as Date,
          status: PayableStatus.TO_PAY,
          source: PayableSource.MANUAL,
          isRecurring: true,
          recurrence: rule,
          seriesId,
          occurrenceDate: next,
          remindDaysBefore: newest.remindDaysBefore,
          comment: newest.comment,
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      const newId = (inserted.raw as Array<{ id: string }>)[0]?.id;
      if (!newId) {
        // Another run made it first: look again from the newest, unless nothing moved.
        if (conflictAt === newest.id) break;
        conflictAt = newest.id;
        continue;
      }
      created += 1;
      // The same workspace tags as the bill it was made from.
      await manager.query(
        `INSERT INTO "payable_tags" ("payable_id", "tag_id")
         SELECT $1, "tag_id" FROM "payable_tags" WHERE "payable_id" = $2
         ON CONFLICT DO NOTHING`,
        [newId, newest.id],
      );
    }
    return created;
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
