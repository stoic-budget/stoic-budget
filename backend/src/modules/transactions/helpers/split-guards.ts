import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import type { SplitTransactionBody } from '../../../contracts';
import type { Transaction } from '../../../entities/transaction.entity';
import type { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { assertSplitAllowed } from './pair-guards';

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The member id of the user splitting rows in this workspace, or null without one. */
export async function memberIdOf(
  members: Repository<WorkspaceMember>,
  workspaceId: string,
  userId: string,
): Promise<string | null> {
  const member = await members.findOne({ where: { workspaceId, userId }, select: { id: true } });
  return member?.id ?? null;
}

/**
 * A private row is its owner's to split or put back together. Anyone else
 * would fold a row they cannot read into one they can, or the other way round.
 */
export function assertMayReshape(
  rows: ReadonlyArray<Pick<Transaction, 'isPrivate' | 'ownerMemberId'>>,
  viewerMemberId: string | null,
): void {
  if (rows.some(row => !canReadPrivate(row, viewerMemberId))) {
    throw new ForbiddenException(appError('TRANSACTION_SPLIT_PRIVATE_NOT_OWNER'));
  }
}

/**
 * Guards that a transaction may be split, and returns its authoritative amount.
 *
 * Called twice: once outside the DB transaction as a cheap fast path, and again
 * on the locked row, which is the read the parts are actually derived from.
 */
export function assertSplittable(
  transaction: Transaction,
  dto: SplitTransactionBody,
  viewerMemberId: string | null,
): number {
  assertMayReshape([transaction], viewerMemberId);

  // Not split already, and not a balance adjustment (a one-leg pair).
  assertSplitAllowed(transaction);

  // A transfer between own accounts, an investment or a reimbursement is kept
  // out of spending by its link; the parts would not carry it and would count.
  if (
    transaction.transferPairId ||
    transaction.investmentAccountId ||
    transaction.reimbursementOfId
  ) {
    throw new BadRequestException(appError('TRANSACTION_SPLIT_LINKED'));
  }

  // A duplicate-flagged row is excluded from dashboards and reports. Splitting it
  // would produce siblings that default to isDuplicate=false, so the sibling
  // amounts would reappear in those totals. Refuse instead.
  if (transaction.isDuplicate) {
    throw new BadRequestException(appError('TRANSACTION_SPLIT_DUPLICATE'));
  }

  // A pending row counts nowhere, and its parts would default to booked rows
  // that count. Its booked version replaces it in place; split that one.
  if (transaction.isPending) {
    throw new BadRequestException(appError('TRANSACTION_SPLIT_PENDING'));
  }

  // A locked row has already been reported on a filed return. Splitting it
  // re-assesses the tax across the parts, which would change figures that
  // have been submitted to a tax authority.
  if (transaction.taxLocked) {
    throw new BadRequestException(appError('TRANSACTION_SPLIT_TAX_LOCKED'));
  }

  const total = Number(transaction.amount ?? transaction.debit ?? transaction.credit ?? Number.NaN);
  if (!Number.isFinite(total) || total <= 0) {
    throw new BadRequestException(appError('TRANSACTION_SPLIT_NOT_POSITIVE'));
  }

  const partsTotal = round2(dto.parts.reduce((sum, part) => sum + Number(part.amount), 0));
  // Round the drift too: |99.99 - 100| is 0.010000000000005 in binary floating
  // point, which would reject the very boundary the tolerance exists to accept.
  if (round2(Math.abs(partsTotal - total)) > 0.01) {
    throw new BadRequestException(
      appError('TRANSACTION_SPLIT_SUM_MISMATCH', { total, received: partsTotal }),
    );
  }

  return total;
}
