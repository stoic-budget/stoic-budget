import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { QueryDeepPartialEntity, Repository } from 'typeorm';
import { type Transaction, TransactionType } from '../../../entities/transaction.entity';
import type { TransactionsPostedEvent } from '../../notifications/events/notification-events';

/** A row's money changed through `update()`, which no subscriber sees (#609). */
export const TRANSACTIONS_MONEY_CHANGED = 'transactions.money-changed';

/**
 * Writes a receipt's edits onto the row it booked and says so: `update()`
 * reaches no subscriber, so what follows a row's money (a goal contribution)
 * is told here.
 */
export async function updateBookedRow(
  transactions: Repository<Transaction>,
  events: EventEmitter2,
  where: { id: string; workspaceId: string },
  values: QueryDeepPartialEntity<Transaction>,
): Promise<void> {
  await transactions.update(where, values);
  events.emit(TRANSACTIONS_MONEY_CHANGED, {
    workspaceId: where.workspaceId,
    transactionIds: [where.id],
  } satisfies TransactionsPostedEvent);
}

/**
 * The receipt's fields for its scan's transaction. The transaction keeps its
 * statement, and a field the receipt lacks keeps its value: no amount parsed,
 * or no date (the builder would fall back to today).
 */
export function scanTransactionUpdate(
  fields: Partial<Transaction>,
  hasDate: boolean,
): QueryDeepPartialEntity<Transaction> {
  const { statementId: _statementId, workspaceId: _workspaceId, transactionDate, ...rest } = fields;
  const update: QueryDeepPartialEntity<Transaction> = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== null && value !== undefined),
  );
  if (hasDate) {
    update.transactionDate = transactionDate;
  }
  return withLedgerSides(update as Partial<Transaction>) as QueryDeepPartialEntity<Transaction>;
}

/**
 * A booked row carries its amount on the side it moves: debit for spending,
 * credit for income. Every income and spending figure sums those two, so a row
 * with only an amount would count as nothing. A parse may hand the amount over
 * as text; it is a number by the time it is stored.
 */
export function withLedgerSides<T extends Partial<Transaction>>(fields: T): T {
  if (fields.amount === null || fields.amount === undefined) {
    return fields;
  }
  const amount = Math.round(Math.abs(Number(fields.amount)) * 100) / 100;
  if (!Number.isFinite(amount)) {
    return fields;
  }
  const isExpense = fields.transactionType !== TransactionType.INCOME;
  return {
    ...fields,
    amount,
    debit: isExpense ? amount : null,
    credit: isExpense ? null : amount,
  };
}
