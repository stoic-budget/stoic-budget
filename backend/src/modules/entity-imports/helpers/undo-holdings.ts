import { type EntityManager, In } from 'typeorm';
import { Budget } from '../../../entities/budget.entity';
import type { ImportUpdatedRef } from '../../../entities/import-batch.entity';
import { InvestmentHolding } from '../../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../../entities/investment-trade.entity';
import { Payable } from '../../../entities/payable.entity';
import { Subscription } from '../../../entities/subscription.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';

export interface UndoneHoldings {
  removed: number;
  /** Created by the import but traded on since: they stay, their quantity re-derived. */
  kept: string[];
  /** Accounts that lost a holding: their value has to be written again. */
  accountIds: string[];
}

/**
 * Deletes the holdings an import created, except the ones that have trades
 * the import did not bring (entered by hand, or by a later import): an undo
 * takes the import back, never what was added on top of it. Runs after the
 * import's own trades are gone.
 */
export async function removeImportedHoldings(
  manager: EntityManager,
  workspaceId: string,
  ids: string[],
): Promise<UndoneHoldings> {
  if (ids.length === 0) return { removed: 0, kept: [], accountIds: [] };
  const holdings = await manager.find(InvestmentHolding, {
    where: { workspaceId, id: In(ids) },
    select: { id: true, accountId: true },
  });
  const traded = await manager.find(InvestmentTrade, {
    where: { workspaceId, holdingId: In(ids) },
    select: { id: true, holdingId: true },
  });
  const kept = new Set(traded.map(trade => trade.holdingId));
  const gone = holdings.filter(holding => !kept.has(holding.id));
  const removed = gone.length
    ? ((
        await manager.delete(InvestmentHolding, {
          workspaceId,
          id: In(gone.map(holding => holding.id)),
        })
      ).affected ?? 0)
    : 0;
  return {
    removed,
    kept: [...kept],
    accountIds: [...new Set(gone.map(holding => holding.accountId))],
  };
}

/** A holding an import changed: its typed quantity back, and its price as if the import's splits never were. */
async function restoreHolding(
  manager: EntityManager,
  workspaceId: string,
  ref: ImportUpdatedRef,
): Promise<void> {
  const before = ref.before as { quantity: number | string; priceRatio?: number };
  const repo = manager.getRepository(InvestmentHolding);
  const holding = await repo.findOne({
    where: { id: ref.id, workspaceId },
    select: { id: true, price: true },
  });
  if (!holding) return;
  const ratio = Number(before.priceRatio ?? 1) || 1;
  await repo.update(
    { id: ref.id, workspaceId },
    { quantity: Number(before.quantity), price: Number(holding.price) / ratio },
  );
}

/** Every record an import changed, put back as it was before it. */
export async function restoreUpdatedRefs(
  manager: EntityManager,
  workspaceId: string,
  refs: ImportUpdatedRef[],
): Promise<void> {
  for (const ref of refs) {
    if (ref.kind === 'investment_holding') {
      await restoreHolding(manager, workspaceId, ref);
      continue;
    }
    const entity = {
      subscription: Subscription,
      budget: Budget,
      payable: Payable,
      transaction: Transaction,
      wallet: Wallet,
    }[ref.kind];
    await manager.getRepository(entity).update({ id: ref.id, workspaceId }, ref.before as never);
  }
}
