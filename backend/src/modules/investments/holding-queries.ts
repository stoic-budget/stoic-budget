import type { Repository } from 'typeorm';
import type { InvestmentHolding } from '../../entities/investment-holding.entity';
import type { InvestmentTrade } from '../../entities/investment-trade.entity';
import type { Workspace } from '../../entities/workspace.entity';
import type { SecurityPricesService } from './security-prices.service';

/** Holdings of the workspace (or the one asked about) whose quantity their trades give. */
export async function tradedHoldingIds(
  trades: Repository<InvestmentTrade> | undefined,
  workspaceId: string,
  holdingId?: string,
): Promise<Set<string>> {
  if (!trades) return new Set();
  const rows = await trades
    .createQueryBuilder('trade')
    .select('DISTINCT trade.holdingId', 'holdingId')
    .where('trade.workspaceId = :workspaceId', { workspaceId })
    .andWhere("trade.kind <> 'dividend'") // a dividend says nothing about how much is held
    .andWhere(holdingId ? 'trade.holdingId = :holdingId' : '1=1', { holdingId })
    .getRawMany<{ holdingId: string }>();
  return new Set(rows.map(row => row.holdingId));
}

/** The workspace's currency as a three-letter code; KZT when it has none that reads as one. */
export async function workspaceCurrencyOf(
  workspaces: Repository<Workspace>,
  workspaceId: string,
): Promise<string> {
  const workspace = await workspaces.findOne({
    where: { id: workspaceId },
    select: { currency: true },
  });
  const normalized = String(workspace?.currency || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
}

/** How the daily closes of these holdings' symbols are doing, for this workspace. */
export async function priceHealthOf(
  prices: SecurityPricesService | undefined,
  workspaceId: string,
  holdings: InvestmentHolding[],
) {
  const symbols = holdings.flatMap(holding => (holding.symbol ? [holding.symbol] : []));
  return (await prices?.healthFor(workspaceId, symbols)) ?? new Map();
}
