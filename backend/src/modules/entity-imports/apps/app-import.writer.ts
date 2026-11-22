import { randomUUID } from 'node:crypto';
import { type EntityManager, In } from 'typeorm';
import { Category, CategorySource, CategoryType } from '../../../entities/category.entity';
import type { ImportCreatedRef, ImportUpdatedRef } from '../../../entities/import-batch.entity';
import {
  Transaction,
  TransactionType,
  TransferPairSource,
} from '../../../entities/transaction.entity';
import { TransactionCategorySource } from '../../../entities/transaction-category-source';
import { Wallet } from '../../../entities/wallet.entity';
import { createImportStatement } from '../helpers/import-statement';
import { nameKey } from '../helpers/import-values';
import { linkAdoptedLegs } from './app-import-adopt';
import type { FreshTxn } from './app-import-dedupe';
import type { AppName } from './app-model';
import type { PlannedAccount } from './app-plan-accounts';
import type { PlannedCategory, PlannedGroup } from './app-plan-categories';

export interface AppWriteContext {
  manager: EntityManager;
  workspaceId: string;
  userId: string;
  created: ImportCreatedRef[];
  updated: ImportUpdatedRef[];
}

/** New accounts, each with its opening balance; the plan learns their ids. */
export async function createAccounts(
  ctx: AppWriteContext,
  accounts: Map<string, PlannedAccount>,
): Promise<void> {
  const repo = ctx.manager.getRepository(Wallet);
  for (const account of accounts.values()) {
    if (account.status !== 'created') {
      continue;
    }
    const saved = await repo.save(
      repo.create({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        name: account.name.slice(0, 255),
        type: account.type,
        currency: account.currency,
        initialBalance: account.opening,
        isActive: true,
        ownerMemberId: null,
      }),
    );
    account.walletId = saved.id;
    ctx.created.push({ kind: 'wallet', id: saved.id });
  }
}

/** An account an earlier import created without an opening balance takes the one its own export has. */
export async function setOpenings(
  ctx: AppWriteContext,
  accounts: Map<string, PlannedAccount>,
): Promise<void> {
  for (const account of accounts.values()) {
    if (!(account.status === 'matched' && account.takesOpening && account.walletId)) {
      continue;
    }
    if (account.opening === 0) {
      continue;
    }
    await ctx.manager
      .getRepository(Wallet)
      .update(
        { id: account.walletId, workspaceId: ctx.workspaceId },
        { initialBalance: account.opening },
      );
    ctx.updated.push({ kind: 'wallet', id: account.walletId, before: { initialBalance: 0 } });
  }
}

/** New groups first (top-level categories), then the categories under them. */
export async function createCategories(
  ctx: AppWriteContext,
  groups: Map<string, PlannedGroup>,
  categories: Map<string, PlannedCategory>,
): Promise<void> {
  const repo = ctx.manager.getRepository(Category);
  const save = async (name: string, type: 'income' | 'expense', parentId: string | null) => {
    const saved = await repo.save(
      repo.create({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        name: name.slice(0, 255),
        type: type === 'income' ? CategoryType.INCOME : CategoryType.EXPENSE,
        parentId,
        source: CategorySource.USER,
        isSystem: false,
      }),
    );
    ctx.created.push({ kind: 'category', id: saved.id });
    return saved.id;
  };
  for (const group of groups.values()) {
    if (group.status === 'created') {
      group.id = await save(group.name, group.type, null);
    }
  }
  for (const category of new Set(categories.values())) {
    if (category.status === 'created' && !category.id) {
      const parent = category.group ? groups.get(nameKey(category.group)) : undefined;
      category.id = await save(category.name, category.type, parent?.id ?? null);
    }
  }
}

/**
 * One statement per account, like a bank file, so the rows can be found and
 * removed together. A split's parts share a group id; a transfer's two legs a
 * pair id, a leg the workspace already had included. Rows the source app had categorised, and transfers, were already
 * looked at there and land confirmed; the rest wait in Review.
 */
export async function writeTransactions(
  ctx: AppWriteContext,
  app: AppName,
  txns: FreshTxn[],
  accounts: Map<string, PlannedAccount>,
  categories: Map<string, PlannedCategory>,
): Promise<string[]> {
  const repo = ctx.manager.getRepository(Transaction);
  const splitIds = new Map<string, { id: string; next: number }>();
  const pairIds = new Map<string, string>();
  const statementIds: string[] = [];
  for (const account of accounts.values()) {
    const rows = txns.filter(txn => txn.accountKey === account.key && !txn.adoptId);
    if (!(rows.length && account.walletId)) {
      continue;
    }
    const typeOf = (txn: FreshTxn) =>
      txn.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    const statement = await createImportStatement(
      { ...ctx, fileName: `${app}-${account.name}` },
      rows.map(txn => ({
        date: txn.date,
        merchant: txn.payee,
        purpose: txn.memo,
        amount: Math.abs(txn.amount),
        type: typeOf(txn),
        currency: account.currency,
        categoryName: txn.categoryKey ? (categories.get(txn.categoryKey)?.name ?? '') : '',
      })),
      undefined,
      account.walletId,
      account.currency,
    );
    ctx.created.push({ kind: 'statement', id: statement.id });
    statementIds.push(statement.id);
    const entities = rows.map(txn => {
      const categoryId = txn.categoryKey ? (categories.get(txn.categoryKey)?.id ?? null) : null;
      const split = txn.splitKey
        ? (splitIds.get(txn.splitKey) ?? { id: randomUUID(), next: 0 })
        : null;
      if (split && txn.splitKey) {
        splitIds.set(txn.splitKey, { id: split.id, next: split.next + 1 });
      }
      const pairId = txn.pairKey ? (pairIds.get(txn.pairKey) ?? randomUUID()) : null;
      if (pairId && txn.pairKey) {
        pairIds.set(txn.pairKey, pairId);
      }
      const amount = Math.abs(txn.amount);
      return repo.create({
        workspaceId: ctx.workspaceId,
        statementId: statement.id,
        walletId: account.walletId,
        ownerMemberId: account.ownerMemberId,
        transactionDate: new Date(txn.date),
        counterpartyName: txn.payee.slice(0, 255),
        paymentPurpose: txn.memo,
        debit: txn.amount < 0 ? amount : null,
        credit: txn.amount > 0 ? amount : null,
        amount,
        currency: account.currency,
        transactionType: typeOf(txn),
        categoryId,
        categorySource: categoryId ? TransactionCategorySource.MANUAL : null,
        isVerified: Boolean(categoryId || pairId),
        fingerprint: txn.fingerprint,
        splitGroupId: split?.id ?? null,
        splitIndex: split ? split.next : null,
        transferPairId: pairId,
        transferPairSource: pairId ? TransferPairSource.MANUAL : null,
      });
    });
    await repo.save(entities, { chunk: 500 });
  }
  await linkAdoptedLegs(ctx.manager, ctx.workspaceId, txns, pairIds, ctx.updated);
  return statementIds;
}

/** Payees the rows of these statements point at that did not exist before the import. */
export async function newPayeeIds(
  ctx: AppWriteContext,
  statementIds: string[],
  before: Set<string>,
): Promise<string[]> {
  if (statementIds.length === 0) {
    return [];
  }
  const rows = await ctx.manager.getRepository(Transaction).find({
    select: { payeeId: true },
    where: { workspaceId: ctx.workspaceId, statementId: In(statementIds) },
  });
  return [
    ...new Set(rows.map(row => row.payeeId).filter((id): id is string => Boolean(id))),
  ].filter(id => !before.has(id));
}
