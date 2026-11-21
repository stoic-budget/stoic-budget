import type { Repository } from 'typeorm';
import type { Statement } from '@/entities/statement.entity';
import type { Transaction } from '@/entities/transaction.entity';
import type { Wallet } from '@/entities/wallet.entity';
import type { WorkspaceMember } from '@/entities/workspace-member.entity';
import type { ExchangeRatesService } from '@/modules/exchange-rates/exchange-rates.service';
import { balanceDays, monthDates } from '@/modules/wallets/wallet-balance-days';
import { walletLedgers } from '@/modules/wallets/wallet-ledger';
import { WalletsService } from '@/modules/wallets/wallets.service';
import type { WorkspaceCurrencyService } from '@/modules/workspaces/workspace-currency.service';
import { createRepoMock } from '../../../helpers/create-repo-mock';
import { workspaceCurrencyStub } from '../../../helpers/workspace-currency-stub';

vi.mock('@/modules/wallets/wallet-ledger', async importOriginal => ({
  ...(await importOriginal<typeof import('@/modules/wallets/wallet-ledger')>()),
  walletLedgers: vi.fn(),
}));

describe('monthDates', () => {
  it('lists every day of the month, leap February included', () => {
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2026-11')[0]).toBe('2026-11-01');
    expect(monthDates('2026-11').at(-1)).toBe('2026-11-30');
  });
});

describe('balanceDays', () => {
  const OPENING = 1000;
  const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];

  it('opens with every row before the month and carries a quiet day', () => {
    const before = { date: '2026-10-20', net: 200 };
    const spent = { date: '2026-11-02', net: -50 };

    expect(balanceDays(OPENING, [before, spent], dates)).toEqual([
      OPENING + before.net,
      OPENING + before.net + spent.net,
      OPENING + before.net + spent.net,
    ]);
  });

  it('stays at the opening balance with no rows at all', () => {
    expect(balanceDays(OPENING, [], dates)).toEqual([OPENING, OPENING, OPENING]);
  });

  it('leaves out rows after the last date', () => {
    expect(balanceDays(OPENING, [{ date: '2026-12-01', net: 75 }], dates)).toEqual([
      OPENING,
      OPENING,
      OPENING,
    ]);
  });
});

describe('WalletsService.balanceDays', () => {
  const WORKSPACE = 'ws-1';
  const MONTH = '2026-11';
  const USD_RATE = 0.9;

  const wallet = (overrides: Partial<Wallet>): Wallet =>
    ({
      workspaceId: WORKSPACE,
      currency: 'EUR',
      initialBalance: 0,
      isActive: true,
      type: 'checking',
      ...overrides,
    }) as Wallet;

  const everyday = wallet({ id: 'w-everyday', name: 'Everyday Account', initialBalance: 500 });
  const card = wallet({ id: 'w-card', name: 'Card One', type: 'credit_card', currency: 'USD' });
  const savings = wallet({ id: 'w-savings', name: 'Savings Pot', type: 'savings' });
  const closed = wallet({ id: 'w-closed', name: 'Old Account', isActive: false });

  function setup(rateCurve: Array<{ date: string; rate: number }>) {
    const walletRepository = createRepoMock<Wallet>();
    walletRepository.find.mockResolvedValue([everyday, card, savings, closed]);
    const exchangeRates = { getRateCurve: vi.fn(async () => rateCurve) };
    const service = new WalletsService(
      walletRepository as unknown as Repository<Wallet>,
      createRepoMock<WorkspaceMember>() as unknown as Repository<WorkspaceMember>,
      createRepoMock<Transaction>() as unknown as Repository<Transaction>,
      createRepoMock<Statement>() as unknown as Repository<Statement>,
      workspaceCurrencyStub('EUR') as unknown as WorkspaceCurrencyService,
      exchangeRates as unknown as ExchangeRatesService,
    );
    return { service, walletRepository, exchangeRates };
  }

  const spent = { date: '2026-11-02', net: -120 };
  const cardSpend = { date: '2026-11-01', net: -40 };

  // The last day of the month, so every day of it has happened.
  const MONTH_END = new Date('2026-11-30T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MONTH_END);
    vi.mocked(walletLedgers).mockResolvedValue(
      new Map([
        [everyday.id, { days: [spent], net: spent.net, count: 1, lastDate: spent.date, unconverted: [] }],
        [card.id, { days: [cardSpend], net: cardSpend.net, count: 1, lastDate: cardSpend.date, unconverted: [] }],
      ]),
    );
  });

  it('lists only active everyday accounts, in the workspace currency, day by day', async () => {
    const { service, walletRepository } = setup([{ date: '2026-10-31', rate: USD_RATE }]);

    const result = await service.balanceDays(WORKSPACE, MONTH);

    expect(walletRepository.find.mock.calls[0][0]).toMatchObject({
      where: { workspaceId: WORKSPACE },
    });
    expect(vi.mocked(walletLedgers).mock.calls[0][2]).toBe(WORKSPACE);
    expect(result.currency).toBe('EUR');
    expect(result.accounts.map(account => account.id)).toEqual([everyday.id, card.id]);
    expect(result.days).toHaveLength(30);
    expect(result.days[0].balances).toEqual({
      [everyday.id]: 500,
      [card.id]: cardSpend.net * USD_RATE,
    });
    expect(result.days[29].balances[everyday.id]).toBe(500 + spent.net);
    expect(result.unconverted).toEqual([]);
  });

  afterEach(() => vi.useRealTimers());

  it('leaves a day without a rate empty and names its currency', async () => {
    const { service } = setup([{ date: '2026-11-15', rate: USD_RATE }]);

    const result = await service.balanceDays(WORKSPACE, MONTH);

    expect(result.days[0].balances[card.id]).toBeNull();
    expect(result.days[14].balances[card.id]).toBe(cardSpend.net * USD_RATE);
    expect(result.unconverted).toEqual(['USD']);
  });

  it('asks for no rate past today, and gives the days still to come the latest one', async () => {
    const today = '2026-11-14';
    vi.setSystemTime(new Date(`${today}T12:00:00Z`));
    const { service, exchangeRates } = setup([{ date: '2026-10-31', rate: USD_RATE }]);

    const result = await service.balanceDays(WORKSPACE, MONTH);

    for (const call of exchangeRates.getRateCurve.mock.calls) {
      expect(call[3]).toBe(today);
    }
    expect(result.days[29].balances[card.id]).toBe(cardSpend.net * USD_RATE);
    expect(result.unconverted).toEqual([]);
  });

  it("names the currency of an account's own rows the ledger left out for want of a rate", async () => {
    vi.mocked(walletLedgers).mockResolvedValue(
      new Map([
        [everyday.id, { days: [spent], net: spent.net, count: 1, lastDate: spent.date, unconverted: ['GBP'] }],
      ]),
    );
    const { service } = setup([{ date: '2026-10-31', rate: USD_RATE }]);

    expect((await service.balanceDays(WORKSPACE, MONTH)).unconverted).toEqual(['GBP']);
  });
});
