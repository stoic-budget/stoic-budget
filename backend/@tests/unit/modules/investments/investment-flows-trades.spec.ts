import type { Mock } from 'vitest';
import { InvestmentFlowsService } from '@/modules/investments/investment-flows.service';

function queryBuilder(rows: unknown[]) {
  const qb: Record<string, Mock> = {};
  for (const method of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'innerJoin',
    'groupBy',
    'addGroupBy',
    'orderBy',
  ]) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getRawMany = vi.fn(async () => rows);
  return qb;
}

const linked = (accountId: string, type: 'expense' | 'income', pairKind: string | null) => ({
  accountId,
  date: '2025-01-05',
  currency: 'USD',
  type,
  pairKind,
  debit: type === 'expense' ? '500' : '0',
  credit: type === 'income' ? '20' : '0',
});

const trade = (accountId: string, kind: string, gross: string, fee = '0', amount = null as string | null) => ({
  accountId,
  kind,
  date: '2025-02-01',
  currency: 'USD',
  gross,
  fee,
  amount,
});

function service(transactions: unknown[], trades: unknown[]) {
  return new InvestmentFlowsService(
    {} as never,
    { createQueryBuilder: vi.fn(() => queryBuilder(transactions)) } as never,
    {} as never,
    { createQueryBuilder: vi.fn(() => queryBuilder(trades)) } as never,
  );
}

describe('InvestmentFlowsService with trades', () => {
  it('reads the money in and out of a trades-only account from its trades', async () => {
    const flows = await service(
      [],
      [
        trade('acc-b', 'buy', '1000', '5'),
        trade('acc-b', 'sell', '300', '2'),
        trade('acc-b', 'transfer_in', '200'),
        trade('acc-b', 'dividend', '0', '1', '10'),
        trade('acc-b', 'split', '0'),
      ],
    ).loadFlows('ws-1', ['acc-b']);
    expect(flows.map(flow => [flow.kind, flow.amount])).toEqual([
      ['contribution', 1005],
      ['withdrawal', 298],
      ['contribution', 200],
      ['income', 9],
    ]);
  });

  it('lets linked bank rows speak for an account, so a buy is not counted twice', async () => {
    const flows = await service(
      [linked('acc-a', 'expense', 'investment')],
      [
        trade('acc-a', 'buy', '500'),
        trade('acc-a', 'dividend', '0', '0', '7'),
        trade('acc-b', 'buy', '100'),
      ],
    ).loadFlows('ws-1', ['acc-a', 'acc-b']);
    expect(flows.map(flow => [flow.accountId, flow.kind, flow.amount, flow.fromTrades ?? false])).toEqual([
      ['acc-a', 'contribution', 500, false],
      // No dividend is linked for acc-a, so the trade's one counts.
      ['acc-a', 'income', 7, true],
      ['acc-b', 'contribution', 100, true],
    ]);
  });

  it('attributes a trades-only account its net buys inside the window', async () => {
    const byAccount = await service(
      [],
      [trade('acc-b', 'buy', '1000'), trade('acc-b', 'sell', '400'), trade('acc-b', 'dividend', '0', '0', '5')],
    ).contributionsBetween('ws-1', '2025-01-31', '2025-02-28');
    expect(byAccount.get('acc-b')?.get('USD')).toBe(600);
    const outside = await service([], [trade('acc-b', 'buy', '1000')]).contributionsBetween(
      'ws-1',
      '2025-02-01',
      '2025-02-28',
    );
    // The window opens after its first day, as for linked rows.
    expect(outside.get('acc-b')).toBeUndefined();
  });

  it('keeps a linked dividend and drops the trade one for the same account', async () => {
    const flows = await service(
      [linked('acc-a', 'income', null)],
      [trade('acc-a', 'dividend', '0', '0', '20'), trade('acc-a', 'buy', '50')],
    ).loadFlows('ws-1', ['acc-a']);
    expect(flows.map(flow => [flow.kind, flow.fromTrades ?? false])).toEqual([
      ['income', false],
      ['contribution', true],
    ]);
  });
});
