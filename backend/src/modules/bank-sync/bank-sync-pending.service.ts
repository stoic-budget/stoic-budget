import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, Not, type Repository } from 'typeorm';
import { generateTransactionFingerprint } from '../../common/utils/fingerprint.util';
import { Transaction, TransactionType } from '../../entities';
import type { TransactionsPostedEvent } from '../notifications/events/notification-events';
import { IntelligentDeduplicationService } from '../parsing/services/intelligent-deduplication.service';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import type { BankSyncAccountSetting } from './bank-sync.config';
import { asComparable, asParsedTransaction } from './bank-sync-dedupe.service';
import { providerRowKey } from './bank-sync-ofx.util';
import { planPendingRows } from './bank-sync-pending';
import type { BankSyncTransaction } from './bank-sync-provider.interface';

export interface PendingSettlement {
  /** Rows still to import: new booked rows and new pending ones. */
  incoming: BankSyncTransaction[];
  /** Pending rows that became their booked version this pull. */
  posted: string[];
  /** Pending rows removed because they never booked. */
  removed: number;
}

/** The money fields of a pulled row, as a stored row holds them. */
function moneyOf(row: BankSyncTransaction) {
  const amount = Math.abs(row.amount);
  const out = row.amount < 0;
  return {
    // A `date` column: the provider's day, never shifted by the server's zone.
    transactionDate: row.posted.toISOString().slice(0, 10) as unknown as Date,
    amount,
    debit: out ? amount : null,
    credit: out ? null : amount,
    transactionType: out ? TransactionType.EXPENSE : TransactionType.INCOME,
  };
}

/**
 * Keeps the account's pending rows in step with the bank: a booked version
 * turns its pending row into the booked one, a row still pending takes the
 * bank's latest amount and date, and one that never books is removed.
 *
 * The pending row is turned into the booked one in place rather than replaced
 * by a new row: it is the same purchase, so everything the user did to it
 * (category, comment, tags, payee, approval, a receipt or a goal linked to it)
 * simply stays, with no list of fields to copy that a new column could miss.
 */
@Injectable()
export class BankSyncPendingService {
  private readonly logger = new Logger(BankSyncPendingService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly deduplication: IntelligentDeduplicationService,
    private readonly taxAssignment: TaxAssignmentService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  async settle(
    workspaceId: string,
    account: BankSyncAccountSetting,
    rows: BankSyncTransaction[],
    currency: string,
    now: Date,
  ): Promise<PendingSettlement> {
    const prefix = providerRowKey(account.id, '');
    const stored = (
      await this.transactionRepository.find({
        where: { workspaceId, isPending: true },
        relations: { statement: true },
      })
    ).filter(row => row.documentNumber?.startsWith(prefix));
    const plan = planPendingRows({
      accountId: account.id,
      stored,
      rows,
      known: await this.storedBookedKeys(workspaceId, account.id, rows),
      now,
      isSame: (row, candidate) =>
        this.deduplication.applyTolerantRules(
          asParsedTransaction(row, currency),
          asComparable(candidate as Transaction),
        ).isMatch,
    });
    if (plan.post.length + plan.refresh.length + plan.remove.length === 0) {
      return { incoming: plan.incoming, posted: [], removed: 0 };
    }

    const byId = new Map(stored.map(row => [row.id, row]));
    await this.transactionRepository.manager.transaction(async manager => {
      for (const { storedId, row } of plan.refresh) {
        await manager.update(
          Transaction,
          { id: storedId, workspaceId, isPending: true },
          moneyOf(row),
        );
      }
      for (const { storedId, row } of plan.post) {
        await this.post(manager, workspaceId, byId.get(storedId) as Transaction, account.id, row);
      }
      if (plan.remove.length > 0) {
        await manager.delete(Transaction, { id: In(plan.remove), workspaceId, isPending: true });
      }
    });

    const posted = plan.post.map(entry => entry.storedId);
    if (posted.length > 0) {
      // Tax was assessed on the pending amount; the booked one may differ.
      await this.taxAssignment.reassess(workspaceId, { ids: posted });
      this.eventEmitter?.emit('transactions.posted', {
        workspaceId,
        transactionIds: posted,
      } satisfies TransactionsPostedEvent);
    }
    if (plan.remove.length > 0) {
      this.logger.log(
        `Bank sync: removed ${plan.remove.length} pending rows of account ${account.id} that never booked`,
      );
    }
    return { incoming: plan.incoming, posted, removed: plan.remove.length };
  }

  /** The provider keys of listed booked rows the workspace already holds as booked rows. */
  private async storedBookedKeys(
    workspaceId: string,
    accountId: string,
    rows: BankSyncTransaction[],
  ): Promise<Set<string>> {
    const keys = rows.filter(row => !row.pending).map(row => providerRowKey(accountId, row.id));
    const known = new Set<string>();
    for (let offset = 0; offset < keys.length; offset += 500) {
      const existing = await this.transactionRepository.find({
        where: {
          workspaceId,
          isPending: false,
          documentNumber: In(keys.slice(offset, offset + 500)),
        },
        select: { documentNumber: true },
      });
      for (const row of existing) {
        if (row.documentNumber) known.add(row.documentNumber);
      }
    }
    return known;
  }

  /**
   * Makes a pending row its booked version: the bank's amount, day and id, a
   * fingerprint so a statement uploaded later recognises it, and back to
   * Review when the amount moved (an approval was given to another figure).
   */
  private async post(
    manager: EntityManager,
    workspaceId: string,
    stored: Transaction,
    accountId: string,
    row: BankSyncTransaction,
  ): Promise<void> {
    const money = moneyOf(row);
    const fingerprint = generateTransactionFingerprint({
      workspaceId,
      accountNumber: stored.statement?.accountNumber || '',
      date: String(money.transactionDate),
      amount: money.amount,
      currency: stored.currency,
      direction: money.debit === null ? 'credit' : 'debit',
      merchant: stored.counterpartyName ?? '',
    });
    // The booked row may already be in the workspace from a statement upload:
    // then it is a duplicate of that row, as an import would have flagged it.
    const original = await manager.findOne(Transaction, {
      where: {
        workspaceId,
        fingerprint,
        isDuplicate: false,
        id: Not(stored.id),
      },
      select: { id: true },
    });
    const amountMoved = Math.abs(Number(stored.amount) - money.amount) >= 0.005;
    await manager.update(
      Transaction,
      { id: stored.id, workspaceId, isPending: true },
      {
        ...money,
        isPending: false,
        documentNumber: providerRowKey(accountId, row.id),
        fingerprint,
        ...(original ? { isDuplicate: true, duplicateOfId: original.id } : {}),
        ...(amountMoved ? { isVerified: false } : {}),
      },
    );
  }
}
