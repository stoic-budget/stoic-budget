import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { addDays, localDay, toDay } from '../../common/recurrence/date-only';
import { Client } from '../../entities/client.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { Payable, PayableStatus } from '../../entities/payable.entity';
import { Subscription, SubscriptionStatus } from '../../entities/subscription.entity';
import { projectSubscriptionCharges } from '../dashboard/commitment-projections';
import { TaxDeadlinesService } from '../tax-reminders/tax-deadlines.service';
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
import { CalendarFeedPayablesService, parseLocalDay } from './calendar-feed-payables.service';
import type { IcsEvent } from './ics-writer';

/** What the feed may carry for this reader: their choice, narrowed by what their role may see. */
export interface FeedKinds {
  payables: boolean;
  subscriptions: boolean;
  taxDeadlines: boolean;
  invoices: boolean;
}

interface InvoiceRow {
  id: string;
  number: string | null;
  due_date: string;
  currency: string;
  total: string;
  status: InvoiceStatus;
  updated_at: Date;
  client_name: string | null;
  payable_status: PayableStatus | null;
  payable_amount: string | null;
  paid_amount: string | null;
}

/** Charges of one subscription projected at most this many times (a weekly one over the window). */
const MAX_CHARGES = 60;

/** Every event of one member's feed, of the kinds it carries, sorted by day. */
@Injectable()
export class CalendarFeedEventsService {
  constructor(
    private readonly payables: CalendarFeedPayablesService,
    private readonly taxDeadlines: TaxDeadlinesService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async events(context: FeedContext, kinds: FeedKinds): Promise<IcsEvent[]> {
    const groups = await Promise.all([
      kinds.payables ? this.payables.events(context, kinds.invoices) : [],
      kinds.subscriptions ? this.subscriptionEvents(context) : [],
      kinds.taxDeadlines ? this.taxEvents(context) : [],
      kinds.invoices ? this.invoiceEvents(context) : [],
    ]);
    return groups.flat().sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));
  }

  private async subscriptionEvents(context: FeedContext): Promise<IcsEvent[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { workspaceId: context.workspaceId, status: SubscriptionStatus.ACTIVE },
      take: FEED_MAX_ROWS,
    });
    const today = parseLocalDay(context.today);
    const horizon = parseLocalDay(addDays(context.today, FEED_PROJECTION_DAYS));
    return subscriptions.flatMap(subscription => {
      if (!subscription.nextChargeDate || Number(subscription.amount) === 0) return [];
      const summary = fillLabel(context.labels.subscriptionCharge, {
        name: subscription.vendorName,
        amount: feedMoney(context, Number(subscription.amount), subscription.currency),
      });
      return projectSubscriptionCharges(
        parseLocalDay(toDay(subscription.nextChargeDate)),
        subscription.frequency,
        today,
        horizon,
        MAX_CHARGES,
      ).map(charge => ({
        uid: feedUid(context, 'subscription', subscription.id, localDay(charge)),
        date: localDay(charge),
        summary,
        lastModified: subscription.updatedAt,
      }));
    });
  }

  /** Returns due around now; a filed one stays, marked filed. */
  private async taxEvents(context: FeedContext): Promise<IcsEvent[]> {
    const deadlines = await this.taxDeadlines.getUpcoming(context.workspaceId, context.today);
    return deadlines.map(deadline => ({
      uid: feedUid(context, 'tax', deadline.kind, deadline.periodEnd),
      date: deadline.dueDate,
      summary: fillLabel(deadline.done ? context.labels.taxDone : context.labels.taxDue, {
        name: deadline.returnName,
      }),
    }));
  }

  /** Sent invoices by due date; paid and overdue live on the receivable, as everywhere else. */
  private async invoiceEvents(context: FeedContext): Promise<IcsEvent[]> {
    const rows = await this.invoiceRepository
      .createQueryBuilder('i')
      .leftJoin(Client, 'c', 'c.id = i.client_id AND c.workspace_id = i.workspace_id')
      .leftJoin(
        Payable,
        'p',
        'p.id = i.payable_id AND p.workspace_id = i.workspace_id AND p.deleted_at IS NULL',
      )
      .select([
        'i.id AS id',
        'i.invoice_number AS number',
        // As text: a raw `date` would come back as a local midnight and could slip a day in UTC.
        "to_char(i.due_date, 'YYYY-MM-DD') AS due_date",
        'i.currency AS currency',
        'i.total AS total',
        'i.status AS status',
        'i.updated_at AS updated_at',
        'c.name AS client_name',
        'p.status AS payable_status',
        'p.amount AS payable_amount',
        'p.paid_amount AS paid_amount',
      ])
      .where('i.workspace_id = :workspaceId', { workspaceId: context.workspaceId })
      .andWhere('i.deleted_at IS NULL')
      .andWhere('i.status NOT IN (:...hidden)', {
        hidden: [InvoiceStatus.DRAFT, InvoiceStatus.VOID],
      })
      .andWhere('i.due_date BETWEEN :from AND :to', {
        from: addDays(context.today, -FEED_PAST_DAYS),
        to: addDays(context.today, FEED_AHEAD_DAYS),
      })
      .orderBy('i.due_date', 'ASC')
      .limit(FEED_MAX_ROWS)
      .getRawMany<InvoiceRow>();
    return rows.map(row => {
      const paid = row.payable_status === PayableStatus.PAID || row.status === InvoiceStatus.PAID;
      // The receivable carries what is owed: a credit note lowers its amount, not the total.
      const owed = row.payable_amount === null ? Number(row.total) : Number(row.payable_amount);
      const amount = paid ? owed : owed - Number(row.paid_amount ?? 0);
      return {
        uid: feedUid(context, 'invoice', row.id),
        date: row.due_date,
        summary: fillLabel(paid ? context.labels.invoicePaid : context.labels.invoiceDue, {
          number: row.number ?? '',
          name: row.client_name ?? '',
          amount: feedMoney(context, amount, row.currency),
        }),
        lastModified: new Date(row.updated_at),
      };
    });
  }
}
