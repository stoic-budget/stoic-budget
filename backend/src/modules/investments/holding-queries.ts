import type { Repository } from 'typeorm';
import type { InvestmentHolding } from '../../entities/investment-holding.entity';
import type { Workspace } from '../../entities/workspace.entity';
import type { SecurityPricesService } from './security-prices.service';

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
