import { type EntityManager, In } from 'typeorm';
import { InvestmentHolding } from '../../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../../entities/investment-trade.entity';

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
