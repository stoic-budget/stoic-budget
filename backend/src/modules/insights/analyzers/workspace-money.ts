import type { Repository } from 'typeorm';
import type { Workspace } from '../../../entities/workspace.entity';
import { loadDayConverter } from '../../exchange-rates/day-converter';
import type { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { normalizeCurrency } from '../../goals/goal-money.util';

/**
 * The workspace currency, and a converter into it for `rows` that come per
 * currency, so 500 UAH is never read as 500 of the workspace's money. A row
 * with a `day` converts at that day's rate, as the dashboard and Reports count
 * it; one without, at today's. A currency with no rate counts as nothing.
 */
export async function workspaceMoney<T extends { currency: string | null; day?: string }>(
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
  const days = rows.map(row => ({ currency: row.currency ?? currency, day: row.day }));
  const convert = await loadDayConverter(exchangeRatesService, currency, days, workspaceId);
  return {
    currency,
    convert: (row, amount) => convert(amount, row.currency ?? currency, row.day),
  };
}
