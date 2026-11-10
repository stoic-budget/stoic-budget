import type { Repository } from 'typeorm';
import type { InvestmentTrade } from '../../entities/investment-trade.entity';

/** Holdings of the workspace (or the one asked about) whose quantity their trades give. */
export async function tradedHoldingIds(
  tradeRepository: Repository<InvestmentTrade> | undefined,
  workspaceId: string,
  holdingId?: string,
): Promise<Set<string>> {
  if (!tradeRepository) return new Set();
  const rows = await tradeRepository
    .createQueryBuilder('trade')
    .select('DISTINCT trade.holdingId', 'holdingId')
    .where('trade.workspaceId = :workspaceId', { workspaceId })
    .andWhere("trade.kind <> 'dividend'") // a dividend says nothing about how much is held
    .andWhere(holdingId ? 'trade.holdingId = :holdingId' : '1=1', { holdingId })
    .getRawMany<{ holdingId: string }>();
  return new Set(rows.map(row => row.holdingId));
}
