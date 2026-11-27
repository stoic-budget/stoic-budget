import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, type Repository } from 'typeorm';
import { formatDay } from '../../common/recurrence/date-only';
import { notInVersionWorkspace } from '../../common/workspaces/version-workspaces';
import { LoanTerms } from '../../entities/loan-terms.entity';
import {
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
} from '../../entities/payable.entity';
import { Wallet } from '../../entities/wallet.entity';
import { PayableRecurrenceService } from '../payables/payable-recurrence.service';
import { lockSeries } from '../payables/series-lock';
import { buildSchedule } from './engine/loan-plan';
import { LoanPaymentMatcher } from './loan-payment-matcher';
import { planInputOf } from './loan-plan-input';
import {
  amountsByDate,
  deleteUntouched,
  endLoanReminders,
  endOtherSeries,
  lockLoan,
  reminderRule,
  UNTOUCHED_SQL,
} from './loan-reminder-series';

/**
 * Loan payments as repeating bills: while a loan's terms ask for reminders,
 * one bill series follows its schedule (the payment dates, the amount of
 * each), so the bills' reminders, overdue notices, dashboard and forecast
 * cover the loan with nothing of their own. The terms own the series: it is
 * brought back in step whenever they are saved and every morning, before the
 * bills' own job sends the day's reminders.
 */
@Injectable()
export class LoanRemindersService {
  private readonly logger = new Logger(LoanRemindersService.name);

  constructor(
    @InjectRepository(LoanTerms) private readonly terms: Repository<LoanTerms>,
    @InjectRepository(Payable) private readonly payables: Repository<Payable>,
    private readonly recurrence: PayableRecurrenceService,
    private readonly matcher: LoanPaymentMatcher,
  ) {}

  /** Every loan with reminders, and every loan series whose terms are gone or stopped reminding. */
  async syncAll(today = formatDay(new Date())): Promise<void> {
    const loans: Array<{ workspace_id: string; wallet_id: string }> = await this.payables.query(
      `SELECT "workspace_id", "wallet_id" FROM "loan_terms" lt
        WHERE lt."remind_days_before" IS NOT NULL AND ${notInVersionWorkspace('lt."workspace_id"')}
       UNION
       SELECT DISTINCT p."workspace_id", p."loan_wallet_id"
         FROM "payables" p
        WHERE p."loan_wallet_id" IS NOT NULL AND p."recurrence" IS NOT NULL
          AND ${notInVersionWorkspace('p."workspace_id"')}`,
    );
    for (const loan of loans) {
      try {
        await this.sync(loan.workspace_id, loan.wallet_id, today);
      } catch (error) {
        this.logger.error(
          `Failed to bring the payment bills of loan ${loan.wallet_id} in step`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  /** Payments that reached the workspace's loan accounts settle the bills they pay. */
  async settleWorkspace(workspaceId: string): Promise<void> {
    const loans = await this.terms.find({
      where: { workspaceId, remindDaysBefore: Not(IsNull()) },
      select: { walletId: true },
    });
    for (const loan of loans) {
      await this.matcher.settle(workspaceId, loan.walletId);
    }
  }

  /**
   * Brings the loan's bill series in step with its terms, or ends it when the
   * terms are gone or ask for no reminders. Then settles the bills the
   * payments already in the account cover.
   */
  async sync(workspaceId: string, walletId: string, today = formatDay(new Date())): Promise<void> {
    const terms = await this.terms.findOne({
      where: { workspaceId, walletId },
      relations: { wallet: true },
    });
    const rows = terms ? buildSchedule(planInputOf(terms)).rows : [];
    if (!(terms?.wallet && terms.remindDaysBefore !== null && rows.length > 0)) {
      await this.payables.manager.transaction(manager =>
        endLoanReminders(manager, workspaceId, walletId),
      );
      return;
    }
    const rule = reminderRule(rows, terms.paymentDay);
    const amounts = amountsByDate(rows);
    const seriesId = await this.payables.manager.transaction(async manager => {
      // One sync of a loan at a time: two saves at once would each start a series.
      await lockLoan(manager, workspaceId, walletId);
      const newest = await manager.getRepository(Payable).findOne({
        where: { workspaceId, loanWalletId: walletId, seriesId: Not(IsNull()) },
        order: { occurrenceDate: 'DESC' },
        withDeleted: true,
      });
      if (newest?.seriesId) await lockSeries(manager, workspaceId, newest.seriesId);
      // A payment date that moved leaves its untouched bill behind: it goes.
      await deleteUntouched(manager, workspaceId, walletId, [...amounts.keys()]);
      const live = newest?.seriesId
        ? await manager.getRepository(Payable).exists({
            where: { workspaceId, seriesId: newest.seriesId },
            withDeleted: true,
          })
        : false;
      const kept =
        newest?.seriesId && live
          ? newest.seriesId
          : await this.startSeries(manager, terms.wallet, terms.remindDaysBefore as number, today, {
              rule,
              amounts,
            });
      // Any other series of the loan (left by an older version) stops, its untouched bills go.
      await endOtherSeries(manager, workspaceId, walletId, kept);
      if (!kept || kept !== newest?.seriesId) return kept;
      await manager.query(
        `UPDATE "payables"
            SET "recurrence" = $1::jsonb, "is_recurring" = true, "remind_days_before" = $2
          WHERE "workspace_id" = $3 AND "series_id" = $4`,
        [JSON.stringify(rule), terms.remindDaysBefore, workspaceId, newest.seriesId],
      );
      return newest.seriesId;
    });
    if (!seriesId) return;
    await this.recurrence.ensureSeries(workspaceId, seriesId, today);
    await this.followSchedule(workspaceId, walletId, terms.wallet.name, amounts);
    await this.matcher.settle(workspaceId, walletId);
  }

  /** The first bill of a new series: the first payment date from today on. Null when none is left. */
  private async startSeries(
    manager: Repository<Payable>['manager'],
    wallet: Wallet,
    remindDaysBefore: number,
    today: string,
    { rule, amounts }: { rule: ReturnType<typeof reminderRule>; amounts: Map<string, number> },
  ): Promise<string | null> {
    const next = [...amounts.keys()].find(date => date >= today);
    if (!next) return null;
    const id = randomUUID();
    await manager.getRepository(Payable).insert({
      id,
      workspaceId: wallet.workspaceId,
      createdById: null,
      direction: PayableDirection.PAYABLE,
      vendor: wallet.name,
      amount: amounts.get(next) as number,
      currency: wallet.currency.toUpperCase(),
      dueDate: next as unknown as Date,
      status: PayableStatus.TO_PAY,
      source: PayableSource.MANUAL,
      isRecurring: true,
      recurrence: rule,
      seriesId: id,
      occurrenceDate: next,
      remindDaysBefore,
      loanWalletId: wallet.id,
    });
    return id;
  }

  /** Untouched bills ask for what the schedule says on their date, under the account's name. */
  private async followSchedule(
    workspaceId: string,
    walletId: string,
    vendor: string,
    amounts: Map<string, number>,
  ): Promise<void> {
    const dates = [...amounts.keys()];
    await this.payables.query(
      `UPDATE "payables" p
          SET "amount" = s."amount", "vendor" = $3
         FROM unnest($4::date[], $5::numeric[]) AS s("date", "amount")
        WHERE p."workspace_id" = $1 AND p."loan_wallet_id" = $2 AND p."deleted_at" IS NULL
          AND p."occurrence_date" = s."date" AND ${UNTOUCHED_SQL}
          AND (p."amount" <> s."amount" OR p."vendor" <> $3)`,
      [workspaceId, walletId, vendor, dates, dates.map(date => amounts.get(date))],
    );
  }
}
