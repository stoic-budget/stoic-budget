import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { addDays, parseDay, toDay } from '../../common/recurrence/date-only';
import { readablePrivateSql } from '../../common/utils/transaction-privacy.util';
import { Payable, PayableDirection, PayableStatus } from '../../entities/payable.entity';
import { newestRecurringPayables, projectedOccurrences } from '../dashboard/commitment-projections';
import {
  FEED_AHEAD_DAYS,
  FEED_MAX_ROWS,
  FEED_PAST_DAYS,
  FEED_PROJECTION_DAYS,
  type FeedContext,
  feedMoney,
  feedUid,
  fillLabel,
} from './calendar-feed-format';
import type { IcsEvent } from './ics-writer';

/** Still owed, in part or in whole. */
const OPEN_STATUSES = [
  PayableStatus.TO_PAY,
  PayableStatus.SCHEDULED,
  PayableStatus.PARTIALLY_PAID,
  PayableStatus.OVERDUE,
];

/**
 * A bill paid with (or linked to) somebody else's private transaction: its
 * counterparty would say what the private row was, so the feed leaves it out.
 */
const PRIVATE_TO_OTHERS = `EXISTS (
  SELECT 1 FROM "transactions" t
   WHERE t."workspace_id" = p."workspace_id"
     AND (t."id" = p."linked_transaction_id"
          OR t."id" IN (SELECT pp."transaction_id" FROM "payable_payments" pp
                         WHERE pp."payable_id" = p."id" AND pp."workspace_id" = p."workspace_id"))
     AND NOT ${readablePrivateSql('t', ':viewerMemberId')}
)`;

/** A sent invoice stands for its receivable: with invoices in the feed, it shows once, as the invoice. */
const INVOICED = `EXISTS (
  SELECT 1 FROM "invoices" i
   WHERE i."payable_id" = p."id" AND i."workspace_id" = p."workspace_id" AND i."deleted_at" IS NULL
)`;

/**
 * Bills and expected payments for the feed: open ones, the ones paid lately
 * (marked paid, so they do not disappear), and the occurrences of repeating
 * ones the scheduler has not made yet.
 */
@Injectable()
export class CalendarFeedPayablesService {
  constructor(
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
  ) {}

  async events(context: FeedContext, invoicesShown: boolean): Promise<IcsEvent[]> {
    const builder = this.payableRepository
      .createQueryBuilder('p')
      .where('p.workspaceId = :workspaceId', { workspaceId: context.workspaceId })
      .andWhere('p.deletedAt IS NULL')
      .andWhere('p.skippedAt IS NULL')
      .andWhere('p.dueDate BETWEEN :from AND :to', {
        from: addDays(context.today, -FEED_PAST_DAYS),
        to: addDays(context.today, FEED_AHEAD_DAYS),
      })
      .andWhere('p.status IN (:...statuses)', { statuses: [...OPEN_STATUSES, PayableStatus.PAID] })
      .andWhere(`NOT ${PRIVATE_TO_OTHERS}`, { viewerMemberId: context.memberId })
      .orderBy('p.dueDate', 'ASC')
      .take(FEED_MAX_ROWS);
    if (invoicesShown) builder.andWhere(`NOT ${INVOICED}`);
    const rows = await builder.getMany();
    return [...rows.flatMap(row => this.toEvent(context, row)), ...(await this.projected(context))];
  }

  private toEvent(context: FeedContext, payable: Payable): IcsEvent[] {
    if (!payable.dueDate) return [];
    const paid = payable.status === PayableStatus.PAID;
    const owed = paid
      ? Number(payable.amount)
      : Number(payable.amount) - Number(payable.paidAmount ?? 0);
    const occurrence = payable.seriesId && payable.occurrenceDate;
    return [
      {
        // An occurrence keeps the UID it had while it was only projected.
        uid: occurrence
          ? feedUid(context, 'payable', payable.seriesId ?? '', toDay(payable.occurrenceDate ?? ''))
          : feedUid(context, 'payable', payable.id),
        date: toDay(payable.dueDate),
        summary: this.summary(context, payable, owed, paid),
        lastModified: payable.updatedAt,
        alarmDaysBefore: paid ? null : payable.remindDaysBefore,
      },
    ];
  }

  /** The occurrences of each live series after its newest bill, inside the projection window. */
  private async projected(context: FeedContext): Promise<IcsEvent[]> {
    const series = await newestRecurringPayables(this.payableRepository, context.workspaceId, null);
    const hidden = await this.privateToOthers(
      context,
      series.map(newest => newest.id),
    );
    const today = parseLocalDay(context.today);
    const horizon = parseLocalDay(addDays(context.today, FEED_PROJECTION_DAYS));
    return series
      .filter(newest => !hidden.has(newest.id))
      .flatMap(newest =>
        projectedOccurrences(newest, today, horizon).map(next => ({
          uid: feedUid(context, 'payable', newest.seriesId ?? newest.id, next.occurrenceDate),
          date: next.date,
          summary: this.summary(context, newest, next.amount, false),
          lastModified: newest.updatedAt,
          alarmDaysBefore: newest.remindDaysBefore,
        })),
      );
  }

  private summary(context: FeedContext, payable: Payable, amount: number, paid: boolean): string {
    const receivable = payable.direction === PayableDirection.RECEIVABLE;
    const key = receivable
      ? paid
        ? 'receivablePaid'
        : 'receivableDue'
      : paid
        ? 'payablePaid'
        : 'payableDue';
    return fillLabel(context.labels[key], {
      name: payable.vendor,
      amount: feedMoney(context, amount, payable.currency),
    });
  }

  /** Of these bills, the ones tied to another member's private transaction. */
  private async privateToOthers(context: FeedContext, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.payableRepository
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .where('p.workspaceId = :workspaceId', { workspaceId: context.workspaceId })
      .andWhere('p.id IN (:...ids)', { ids })
      .andWhere(PRIVATE_TO_OTHERS, { viewerMemberId: context.memberId })
      .getRawMany<{ id: string }>();
    return new Set(rows.map(row => row.id));
  }
}

/** `YYYY-MM-DD` as a local midnight, the form the projection helpers take. */
export function parseLocalDay(day: string): Date {
  const utc = parseDay(day);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}
