import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  type DataSource,
  type EntityManager,
  type EntitySubscriberInterface,
  Not,
  type UpdateEvent,
} from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { followPaymentPrivacy } from './loan-interest-row';
import { amountOf, toDay } from './loan-payment-rows';

/** A saved row as it will be: the stored one with what the save changes. */
function merged(entity: Transaction, before: Transaction): Transaction {
  const next = { ...before } as Transaction;
  for (const [field, value] of Object.entries(entity)) {
    if (value !== undefined) {
      (next as unknown as Record<string, unknown>)[field] = value;
    }
  }
  return next;
}

const currencyOf = (row: Transaction) => row.currency.trim().toUpperCase();

/**
 * Keeps a loan payment and the interest split off it (loan-interest-row) one
 * thing through the edits made with `save()` (the transaction form, a split,
 * Review). The database trigger keeps them in step on every other write; this
 * refuses, with the reason, what would tear them apart:
 *
 * - the interest row leaving its loan account or becoming income: it is the
 *   loan's charge, and the checking account would then fall by it twice;
 * - the interest growing past its payment: the principal would go negative;
 * - a generic split of the payment: its parts could not all carry the one
 *   interest row (split the interest itself instead, or join back first);
 * - while the interest is on a filed tax return, an edit of the payment that
 *   would move the interest's day or privacy, or join it back (another
 *   account, type or currency, an amount below the interest), as the same
 *   edit of a locked row is refused.
 *
 * Making a payment private (or public again) moves its interest in or out of
 * the workspace's Private category too, as the payment's own category moved.
 */
@Injectable()
export class LoanInterestGuardSubscriber implements EntitySubscriberInterface<Transaction> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Transaction;
  }

  async beforeUpdate(event: UpdateEvent<Transaction>): Promise<void> {
    const entity = event.entity as Transaction | undefined;
    const before = event.databaseEntity;
    if (!(entity && before?.workspaceId)) {
      return;
    }
    const next = merged(entity, before);
    if (before.loanInterestOfId) {
      await this.guardInterest(event.manager, before, next);
    } else if (before.transactionType === TransactionType.INCOME) {
      await this.guardPayment(event.manager, before, next);
    }
  }

  async afterUpdate(event: UpdateEvent<Transaction>): Promise<void> {
    const entity = event.entity as Transaction | undefined;
    const before = event.databaseEntity;
    if (
      !(entity && before?.workspaceId) ||
      before.loanInterestOfId ||
      entity.isPrivate === undefined ||
      entity.isPrivate === before.isPrivate
    ) {
      return;
    }
    await followPaymentPrivacy(event.manager, before.workspaceId, before.id, entity.isPrivate);
  }

  private async guardInterest(
    manager: EntityManager,
    before: Transaction,
    next: Transaction,
  ): Promise<void> {
    if (next.walletId !== before.walletId || next.transactionType !== before.transactionType) {
      throw new BadRequestException(appError('LOAN_INTEREST_STAYS_ON_LOAN'));
    }
    // Joining split interest back sums its parts: the total does not change.
    const unsplitting = !!before.splitGroupId && !next.splitGroupId;
    const minor = toMinor(amountOf(next));
    if (unsplitting || minor <= toMinor(amountOf(before))) {
      return;
    }
    const repo = manager.getRepository(Transaction);
    const payment = await repo.findOne({
      where: { workspaceId: before.workspaceId, id: before.loanInterestOfId as string },
    });
    const others = await repo.find({
      where: {
        workspaceId: before.workspaceId,
        loanInterestOfId: before.loanInterestOfId as string,
        id: Not(before.id),
      },
    });
    const total = others.reduce((sum, row) => sum + toMinor(amountOf(row)), minor);
    if (payment && total > toMinor(amountOf(payment))) {
      throw new BadRequestException(
        appError('LOAN_PAYMENT_INTEREST_TOO_LARGE', {
          amount: fromMinor(toMinor(amountOf(payment))),
        }),
      );
    }
  }

  private async guardPayment(
    manager: EntityManager,
    before: Transaction,
    next: Transaction,
  ): Promise<void> {
    const splitting = !before.splitGroupId && !!next.splitGroupId;
    const moved: Record<string, boolean> = {
      walletId: next.walletId !== before.walletId,
      transactionType: next.transactionType !== before.transactionType,
      currency: currencyOf(next) !== currencyOf(before),
      transactionDate: toDay(next.transactionDate) !== toDay(before.transactionDate),
      isPrivate: next.isPrivate !== before.isPrivate,
      amount: toMinor(amountOf(next)) < toMinor(amountOf(before)),
    };
    if (!(splitting || Object.values(moved).some(Boolean))) {
      return;
    }
    const interest = await manager.getRepository(Transaction).find({
      where: { workspaceId: before.workspaceId, loanInterestOfId: before.id },
    });
    if (interest.length === 0) {
      return;
    }
    if (splitting) {
      throw new ConflictException(appError('LOAN_PAYMENT_SPLIT_FIRST_JOIN'));
    }
    if (!interest.some(row => row.taxLocked)) {
      return;
    }
    // A lower amount that still covers the interest leaves it be.
    const interestMinor = interest.reduce((sum, row) => sum + toMinor(amountOf(row)), 0);
    moved.amount = toMinor(amountOf(next)) < interestMinor;
    const fields = Object.keys(moved).filter(field => moved[field]);
    if (fields.length > 0) {
      throw new BadRequestException(
        appError('TRANSACTION_TAX_LOCKED_FIELDS', { fields: fields.join(', ') }),
      );
    }
  }
}
