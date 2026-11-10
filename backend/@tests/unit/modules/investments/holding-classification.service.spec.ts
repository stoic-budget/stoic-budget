import {
  InvestmentAssetClass,
  type InvestmentHolding,
} from '@/entities/investment-holding.entity';
import { HoldingClassificationService } from '@/modules/investments/holding-classification.service';

const holding = (overrides: Partial<InvestmentHolding>): InvestmentHolding =>
  ({
    id: 'h',
    workspaceId: 'ws-1',
    accountId: 'acc',
    symbol: null,
    assetClass: InvestmentAssetClass.ETF,
    quantity: 1,
    price: 0,
    priceCurrency: 'USD',
    metal: null,
    sector: null,
    region: null,
    country: null,
    lookThrough: null,
    ...overrides,
  }) as InvestmentHolding;

function createService(holdings: InvestmentHolding[], rates: Record<string, number | null>) {
  const holdingRepository = { find: vi.fn(async () => holdings), findOne: vi.fn() };
  const service = new HoldingClassificationService(
    holdingRepository as never,
    {} as never,
    { workspaceCurrency: vi.fn(async () => 'EUR') } as never,
    { getRateOrNull: vi.fn(async (from: string) => rates[from] ?? null) } as never,
    {} as never,
  );
  return { service, holdingRepository };
}

describe('HoldingClassificationService.allocation', () => {
  it('converts to the workspace currency and reads only the caller’s workspace', async () => {
    const { service, holdingRepository } = createService(
      [
        holding({ id: 'a', price: 100, priceCurrency: 'EUR', sector: 'energy' }),
        holding({ id: 'b', price: 50, priceCurrency: 'USD', sector: 'energy' }),
      ],
      { USD: 0.9 },
    );
    const body = await service.allocation('ws-1');
    expect(holdingRepository.find).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1' } });
    expect(body.total).toBe(145);
    expect(body.sectors).toEqual([{ key: 'energy', amount: 145, percent: 100 }]);
  });

  it('leaves out and counts a holding with no rate rather than counting it as nothing', async () => {
    const { service } = createService(
      [
        holding({ id: 'a', price: 100, priceCurrency: 'EUR' }),
        holding({ id: 'b', price: 50, priceCurrency: 'ZZZ' }),
      ],
      {},
    );
    const body = await service.allocation('ws-1');
    expect(body.unvalued).toBe(1);
    expect(body.total).toBe(100);
    expect(body.sectors).toEqual([{ key: 'unclassified', amount: 100, percent: 100 }]);
  });

  it('leaves out the holdings of an account the page leaves out, priced or not', async () => {
    const { service } = createService(
      [
        holding({ id: 'a', accountId: 'kept', price: 100, priceCurrency: 'EUR' }),
        holding({ id: 'b', accountId: 'gone', price: 50, priceCurrency: 'EUR' }),
        holding({ id: 'c', accountId: 'gone', price: 50, priceCurrency: 'ZZZ' }),
      ],
      {},
    );
    const body = await service.allocation('ws-1', ['gone']);
    expect(body.total).toBe(100);
    expect(body.unvalued).toBe(0);
  });
});
