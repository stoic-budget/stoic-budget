import { NotFoundException } from '@nestjs/common';
import { In, Not, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { occurrenceFingerprint } from '../../../common/utils/fingerprint.util';
import { Transaction } from '../../../entities/transaction.entity';

/** More repeats of one payment than any statement prints; past it the row keeps no fingerprint. */
const MAX_OCCURRENCE = 50;

/**
 * Counts a flagged row again, scoped to the caller's workspace.
 *
 * Only one counted row may hold a fingerprint (IDX_transactions_unique_fingerprint).
 * Kept beside a counted row with the same one, the kept row takes the next
 * free occurrence fingerprint (as `numberRepeats` would have given it), so a
 * later upload of the same rows still finds it. The rows sharing the
 * fingerprint are locked, so two Keeps at once cannot both take it.
 */
export async function unmarkDuplicate(
  repository: Repository<Transaction>,
  transactionId: string,
  workspaceId: string,
): Promise<Transaction> {
  await repository.manager.transaction(async manager => {
    const transactions = manager.getRepository(Transaction);
    const existing = await transactions.findOneBy({ id: transactionId, workspaceId });
    if (!existing) {
      throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
    }
    const fingerprint = existing.fingerprint
      ? await freeFingerprint(transactions, existing.fingerprint, transactionId, workspaceId)
      : null;
    await transactions.update(
      { id: transactionId, workspaceId },
      {
        isDuplicate: false,
        duplicateOfId: null,
        duplicateConfidence: null,
        duplicateMatchType: null,
        fingerprint,
      },
    );
  });

  const transaction = await repository.findOneBy({ id: transactionId, workspaceId });
  if (!transaction) {
    throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
  }
  return transaction;
}

async function freeFingerprint(
  transactions: Repository<Transaction>,
  base: string,
  transactionId: string,
  workspaceId: string,
): Promise<string | null> {
  const candidates = Array.from({ length: MAX_OCCURRENCE }, (_, index) =>
    occurrenceFingerprint(base, index + 1),
  );
  const holders = await transactions.find({
    where: { workspaceId, fingerprint: In(candidates), id: Not(transactionId) },
    select: { id: true, fingerprint: true, isDuplicate: true },
    lock: { mode: 'pessimistic_write' },
  });
  const taken = new Set(holders.filter(row => !row.isDuplicate).map(row => row.fingerprint));
  return candidates.find(candidate => !taken.has(candidate)) ?? null;
}
