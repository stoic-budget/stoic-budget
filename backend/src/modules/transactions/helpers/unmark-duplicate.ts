import { NotFoundException } from '@nestjs/common';
import { Not, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import type { Transaction } from '../../../entities/transaction.entity';

/** Counts a flagged row again, scoped to the caller's workspace. */
export async function unmarkDuplicate(
  repository: Repository<Transaction>,
  transactionId: string,
  workspaceId: string,
): Promise<Transaction> {
  const existing = await repository.findOneBy({ id: transactionId, workspaceId });
  if (!existing) {
    throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
  }

  // Only one counted row may hold a fingerprint (IDX_transactions_unique_fingerprint).
  // Kept beside the row it looked like, this one gives its fingerprint up.
  const twin =
    existing.fingerprint &&
    (await repository.exists({
      where: {
        workspaceId,
        fingerprint: existing.fingerprint,
        isDuplicate: false,
        id: Not(transactionId),
      },
    }));

  await repository.update(
    { id: transactionId, workspaceId },
    {
      isDuplicate: false,
      duplicateOfId: null,
      duplicateConfidence: null,
      duplicateMatchType: null,
      ...(twin ? { fingerprint: null } : {}),
    },
  );

  const transaction = await repository.findOneBy({ id: transactionId, workspaceId });
  if (!transaction) {
    throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
  }
  return transaction;
}
