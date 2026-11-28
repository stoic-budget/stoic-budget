import type { FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { Transaction } from '../../entities/transaction.entity';

/**
 * What every part of a split shares with the whole: a receipt edit may change
 * these. Not the purpose: an item split gives each part its own ("ACME Store:
 * Wireless Buds"), and the payee key is read from it.
 */
const SHARED_BY_PARTS = new Set(['transactionDate', 'counterpartyName', 'payeeId', 'isVerified']);

/**
 * Where and what a receipt edit writes on the row it booked (#686). A row
 * split by items is one part of several: the whole receipt's amount, type,
 * currency or category written into it would count the other parts twice.
 * So a split takes only what all its parts share, and all of them take it;
 * the money stays as split until the split is undone.
 */
export function bookedRowUpdate(
  target: Pick<Transaction, 'id' | 'splitGroupId'>,
  workspaceId: string,
  update: QueryDeepPartialEntity<Transaction>,
): { where: FindOptionsWhere<Transaction>; set: QueryDeepPartialEntity<Transaction> } {
  if (!target.splitGroupId) {
    return { where: { id: target.id, workspaceId }, set: update };
  }
  return {
    // A part on a filed return keeps what it was filed with.
    where: { splitGroupId: target.splitGroupId, workspaceId, taxLocked: false },
    set: Object.fromEntries(
      Object.entries(update).filter(([key]) => SHARED_BY_PARTS.has(key)),
    ) as QueryDeepPartialEntity<Transaction>,
  };
}
