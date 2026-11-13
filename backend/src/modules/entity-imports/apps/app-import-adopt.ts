import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { type EntityManager, In, IsNull, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import type { ImportUpdatedRef } from '../../../entities/import-batch.entity';
import {
  Transaction,
  TransactionType,
  TransferPairSource,
} from '../../../entities/transaction.entity';
import { TransactionCategorySource } from '../../../entities/transaction-category-source';
import { nameKey } from '../helpers/import-values';
import { appFingerprint, type FreshTxn, freshTransactions } from './app-import-dedupe';
import type { PlannedAccount } from './app-plan-accounts';
import type { PlannedTxn } from './app-plan-transactions';

/**
 * The rows to book. A transfer leg the workspace already has is taken over
 * rather than written again, so one transfer never ends up as an expense plus
 * a pair:
 * - an Actual leg booked earlier as an ordinary row, when its payee named an
 *   account the workspace did not know yet (found by that row's fingerprint);
 * - the leg written for an account the files do not cover, when that account
 *   already has a row of the same day, amount and direction that is no
 *   transfer yet: its own export read before, or its bank statement.
 * A pair whose earlier row is a transfer already was booked: it is skipped.
 */
export async function bookableTransactions(
  manager: EntityManager,
  workspaceId: string,
  txns: PlannedTxn[],
  accounts: Map<string, PlannedAccount>,
  ref: (accountKey: string) => string,
): Promise<{ fresh: FreshTxn[]; duplicates: number }> {
  const deduped = await freshTransactions(manager, workspaceId, txns, accounts, ref);
  const repo = manager.getRepository(Transaction);
  const byFormer = new Map<string, FreshTxn>();
  for (const txn of deduped.fresh) {
    if (txn.pairKey && txn.former) {
      const former = { ...txn, identity: txn.former };
      byFormer.set(appFingerprint(workspaceId, former, txn, ref(txn.accountKey)), txn);
    }
  }
  const earlier = byFormer.size
    ? await repo.find({
        select: { id: true, fingerprint: true, transferPairId: true },
        where: { workspaceId, fingerprint: In([...byFormer.keys()]) },
      })
    : [];
  const booked = new Set<string>();
  const taken = new Set<string>();
  for (const row of earlier) {
    const txn = row.fingerprint ? byFormer.get(row.fingerprint) : undefined;
    if (txn?.pairKey && row.transferPairId) {
      booked.add(txn.pairKey);
    } else if (txn) {
      txn.adoptId = row.id;
      taken.add(row.id);
    }
  }
  for (const txn of deduped.fresh) {
    const account = accounts.get(txn.accountKey);
    if (
      txn.synthetic &&
      txn.pairKey &&
      !booked.has(txn.pairKey) &&
      account?.status === 'matched' &&
      account.walletId
    ) {
      txn.adoptId = await sameRowOf(repo, workspaceId, account.walletId, txn, taken);
    }
  }
  const fresh = deduped.fresh.filter(txn => !(txn.pairKey && booked.has(txn.pairKey)));
  return { fresh, duplicates: deduped.duplicates + deduped.fresh.length - fresh.length };
}

/** An unpaired row of the account with the leg's day, amount and direction; the one paid to the other account first. */
async function sameRowOf(
  repo: Repository<Transaction>,
  workspaceId: string,
  walletId: string,
  txn: FreshTxn,
  taken: Set<string>,
): Promise<string | null> {
  const rows = await repo
    .createQueryBuilder('t')
    .select(['t.id', 't.counterpartyName'])
    .where('t.workspaceId = :workspaceId', { workspaceId })
    .andWhere('t.walletId = :walletId', { walletId })
    .andWhere('t.transactionDate = :date', { date: txn.date })
    .andWhere('t.amount = :amount', { amount: Math.abs(txn.amount) })
    .andWhere('t.transactionType = :type', {
      type: txn.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
    })
    .andWhere('t.transferPairId IS NULL')
    .andWhere('t.transferPairSource IS DISTINCT FROM :rejected', {
      rejected: TransferPairSource.REJECTED,
    })
    .andWhere('t.isDuplicate = false')
    .andWhere('t.splitGroupId IS NULL')
    .orderBy('t.createdAt', 'ASC')
    .addOrderBy('t.id', 'ASC')
    .getMany();
  const free = rows.filter(row => !taken.has(row.id));
  const pick =
    free.find(row => nameKey(row.counterpartyName ?? '') === nameKey(txn.payee)) ?? free[0];
  if (pick) {
    taken.add(pick.id);
  }
  return pick?.id ?? null;
}

/**
 * Makes each taken-over row the leg of its pair. A category that was only
 * suggested goes, as when transfers are paired by hand; undo puts back both.
 */
export async function linkAdoptedLegs(
  manager: EntityManager,
  workspaceId: string,
  txns: FreshTxn[],
  pairIds: Map<string, string>,
  updated: ImportUpdatedRef[],
): Promise<void> {
  const repo = manager.getRepository(Transaction);
  for (const txn of txns) {
    if (!(txn.adoptId && txn.pairKey)) {
      continue;
    }
    const pairId = pairIds.get(txn.pairKey) ?? randomUUID();
    pairIds.set(txn.pairKey, pairId);
    const row = await repo.findOne({
      select: {
        id: true,
        transferPairSource: true,
        categoryId: true,
        categorySource: true,
        categoryReason: true,
        isVerified: true,
      },
      where: { id: txn.adoptId, workspaceId, transferPairId: IsNull() },
    });
    if (!row) {
      throw new ConflictException(appError('TRANSACTION_PAIRED_MEANWHILE'));
    }
    const suggested = row.categorySource === TransactionCategorySource.KIND && !row.isVerified;
    const category = {
      categoryId: null,
      categorySource: TransactionCategorySource.DEFAULT,
      categoryReason: null,
    };
    await repo.update(
      { id: row.id, workspaceId },
      {
        transferPairId: pairId,
        transferPairSource: TransferPairSource.MANUAL,
        ...(suggested ? category : {}),
      },
    );
    updated.push({
      kind: 'transaction',
      id: row.id,
      before: {
        transferPairId: null,
        transferPairSource: row.transferPairSource,
        ...(suggested
          ? {
              categoryId: row.categoryId,
              categorySource: row.categorySource,
              categoryReason: row.categoryReason,
            }
          : {}),
      },
    });
  }
}
