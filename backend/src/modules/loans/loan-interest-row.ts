import { type EntityManager, IsNull } from 'typeorm';
import { fromMinor } from '../../common/utils/money.util';
import { Category, CategoryType } from '../../entities/category.entity';
import { type Transaction, TransactionType } from '../../entities/transaction.entity';
import { TransactionCategorySource } from '../../entities/transaction-category-source';
import type { Wallet } from '../../entities/wallet.entity';
import { ensurePrivateCategory, PRIVATE_CATEGORY_NAME } from '../categories/private-category';

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

/**
 * A payment made private (or public again) takes its interest along: the
 * database copies the flag and the owner (the payment trigger), and here the
 * interest's category moves into the workspace's Private one, its own kept
 * for its owner, as the payment's moved. Back out, it gets its own again.
 */
export async function followPaymentPrivacy(
  manager: EntityManager,
  workspaceId: string,
  paymentId: string,
  isPrivate: boolean,
): Promise<void> {
  const categories = manager.getRepository(Category);
  if (!isPrivate) {
    const hidden = await categories.findOne({
      where: {
        workspaceId,
        type: CategoryType.EXPENSE,
        name: PRIVATE_CATEGORY_NAME,
        parentId: IsNull(),
      },
    });
    if (hidden) {
      await manager.query(
        `UPDATE "transactions" SET "category_id" = "private_category_id", "private_category_id" = NULL
          WHERE "workspace_id" = $1 AND "loan_interest_of_id" = $2 AND "category_id" = $3`,
        [workspaceId, paymentId, hidden.id],
      );
    }
    return;
  }
  const [{ count }] = await manager.query(
    `SELECT count(*)::int AS "count" FROM "transactions"
      WHERE "workspace_id" = $1 AND "loan_interest_of_id" = $2`,
    [workspaceId, paymentId],
  );
  if (count === 0) {
    return;
  }
  const hidden = await ensurePrivateCategory(categories, workspaceId, CategoryType.EXPENSE);
  await manager.query(
    `UPDATE "transactions" SET "private_category_id" = "category_id", "category_id" = $3
      WHERE "workspace_id" = $1 AND "loan_interest_of_id" = $2 AND "category_id" IS DISTINCT FROM $3`,
    [workspaceId, paymentId, hidden.id],
  );
}
