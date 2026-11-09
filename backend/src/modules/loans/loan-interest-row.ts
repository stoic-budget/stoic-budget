import type { EntityManager } from 'typeorm';
import { fromMinor } from '../../common/utils/money.util';
import { Category, CategoryType } from '../../entities/category.entity';
import { type Transaction, TransactionType } from '../../entities/transaction.entity';
import { TransactionCategorySource } from '../../entities/transaction-category-source';
import type { Wallet } from '../../entities/wallet.entity';
import { ensurePrivateCategory } from '../categories/private-category';

/**
 * The interest of a loan payment as a row of its own: an expense on the loan
 * account, on the payment's day, in the account's currency, under the
 * workspace's Interest category (none when the workspace removed or turned it
 * off: the row still counts, uncategorised). It belongs to whoever the
 * payment belongs to and is private when the payment is, filed under Private
 * with Interest kept for its owner. It counts only while the payment counts
 * (counted-transactions util); the confirmation is copied now and kept in
 * step by a trigger.
 */
export async function buildInterestRow(
  manager: EntityManager,
  payment: Transaction,
  wallet: Wallet,
  minor: number,
): Promise<Partial<Transaction>> {
  const categories = manager.getRepository(Category);
  const interest = await categories.findOne({
    where: {
      workspaceId: payment.workspaceId,
      systemKey: 'interest',
      type: CategoryType.EXPENSE,
      isEnabled: true,
    },
  });
  const hidden = payment.isPrivate
    ? await ensurePrivateCategory(categories, payment.workspaceId, CategoryType.EXPENSE)
    : null;
  const amount = fromMinor(minor);
  return {
    workspaceId: payment.workspaceId,
    walletId: wallet.id,
    loanInterestOfId: payment.id,
    transactionDate: payment.transactionDate,
    transactionType: TransactionType.EXPENSE,
    amount,
    debit: amount,
    credit: null,
    currency: wallet.currency,
    counterpartyName: wallet.name,
    paymentPurpose: payment.paymentPurpose ?? '',
    categoryId: hidden?.id ?? interest?.id ?? null,
    privateCategoryId: hidden ? (interest?.id ?? null) : null,
    categorySource: interest ? TransactionCategorySource.MANUAL : null,
    branchId: payment.branchId,
    ownerMemberId: payment.ownerMemberId ?? wallet.ownerMemberId,
    isPrivate: payment.isPrivate,
    isVerified: payment.isVerified,
  };
}
