import type { Repository } from 'typeorm';
import type { Workspace } from '../../../entities/workspace.entity';
import type { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith, normalizeCurrency } from '../../goals/goal-money.util';

/**
 * The workspace currency, and a converter into it for `rows` that come per
 * currency, so 500 UAH is never read as 500 of the workspace's money. A
 * currency with no rate counts as nothing (see `convertWith`).
 */
export async function workspaceMoney<T extends { currency: string | null }>(
  workspaceRepository: Repository<Workspace>,
  exchangeRatesService: ExchangeRatesService,
  workspaceId: string,
  rows: T[],
): Promise<{ currency: string; convert: (row: T, amount: string | number) => number }> {
  const workspace = await workspaceRepository.findOne({
    where: { id: workspaceId },
    select: {
      id: true,
      currency: true,
    },
  });
  const currency = normalizeCurrency(workspace?.currency);
  const rates = await buildRateMap(
    exchangeRatesService,
    rows.map(row => row.currency ?? currency),
    currency,
    workspaceId,
  );
  return {
    currency,
    convert: (row, amount) => convertWith(rates, amount, row.currency ?? currency),
  };
}
