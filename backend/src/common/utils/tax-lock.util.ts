import { ConflictException } from '@nestjs/common';
import type { FindOptionsWhere, Repository } from 'typeorm';
import type { Transaction } from '../../entities/transaction.entity';
import { appError } from '../errors/app-error';

export const TAX_LOCKED_ERROR_CODE = 'TAX_LOCKED' as const;

/**
 * Refuses to delete rows that are part of a filed tax return.
 *
 * A filed return was built from these rows and submitted to a tax authority.
 * Deleting one leaves the books disagreeing with what was filed, and the
 * deletion would be invisible in the return itself. The return has to be
 * reopened first — a deliberate, audited step.
 */
export async function assertNoTaxLockedTransactions(
  repository: Repository<Transaction>,
  where: FindOptionsWhere<Transaction>,
): Promise<void> {
  const locked = await repository.count({ where: { ...where, taxLocked: true } });
  if (locked > 0) {
    throw taxLockedConflict(locked);
  }
}

/**
 * The same for rows about to be deleted or taken out of the counts (a
 * statement read again, trashed or deleted, a row deleted): besides a locked
 * row of their own, a row whose loan interest (loans/loan-interest-row) is
 * locked refuses too, since the interest counts and goes with its payment.
 */
export async function assertRowsRemovable(
  repository: Repository<Transaction>,
  where: FindOptionsWhere<Transaction>,
): Promise<void> {
  const own = await repository.count({ where: { ...where, taxLocked: true } });
  const carrying = await repository
    .createQueryBuilder('payment')
    .setFindOptions({ where })
    .innerJoin(
      'transactions',
      'interest',
      'interest.loan_interest_of_id = payment.id AND interest.workspace_id = payment.workspace_id AND interest.tax_locked',
    )
    .getCount();
  if (own + carrying > 0) {
    throw taxLockedConflict(own + carrying);
  }
}

/** The refusal itself, for callers that already hold the rows. */
export function taxLockedConflict(locked: number): ConflictException {
  return new ConflictException(appError(TAX_LOCKED_ERROR_CODE, { count: locked }));
}
