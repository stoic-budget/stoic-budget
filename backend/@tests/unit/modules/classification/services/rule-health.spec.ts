import { TransactionCategorySource } from '@/entities/transaction.entity';
import { RuleHealthService } from '@/modules/classification/services/rule-health.service';

const NOW = new Date(2026, 10, 6);
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const MONTH = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };

const STORE = 'ACME Store';
const condition = { field: 'counterparty_name', operator: 'contains', value: STORE };

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: 'rule-1',
  name: 'Store',
  conditions: [condition],
  matchMode: 'all',
  result: { categoryId: 'food' },
  priority: 1,
  isActive: true,
  matchCount: 5,
  lastMatchedAt: daysAgo(5),
  createdAt: daysAgo(100),
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  counterpartyName: `${STORE} 12`,
  paymentPurpose: '',
  categoryId: 'fun',
  categorySource: TransactionCategorySource.MANUAL,
  isPrivate: false,
  ownerMemberId: null,
  createdAt: daysAgo(10),
  ...overrides,
});

function serviceWith({
  rules = [rule()],
  rows = [] as unknown[],
  suggestions = [] as unknown[],
  dismissed = undefined as string[] | undefined,
  recentRows = 50,
  owned = true,
  filed = { total: '0', byRule: '0' },
} = {}) {
  const qb: Record<string, unknown> = {};
  for (const method of [
    'where',
    'andWhere',
    'orderBy',
    'take',
    'select',
    'addSelect',
    'setParameter',
  ]) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getMany = vi.fn(async () => rows);
  qb.getRawOne = vi.fn(async () => filed);
  const manager = { getRepository: () => ({ countBy: vi.fn(async () => (owned ? 1 : 0)) }) };
  const service = new RuleHealthService(
    { find: vi.fn(async () => rules), manager } as any,
    { createQueryBuilder: () => qb, count: vi.fn(async () => recentRows) } as any,
    {
      findOne: vi.fn(async () =>
        dismissed ? { state: { dismissedSuggestions: dismissed } } : null,
      ),
    } as any,
    { suggest: vi.fn(async () => suggestions) } as any,
  );
  return service;
}

const load = (service: RuleHealthService) => service.load('ws-1', 'user-1', MONTH, NOW);

describe('RuleHealthService', () => {
  it('finds nothing wrong with a rule that works', async () => {
    expect(await load(serviceWith())).toEqual({
      broken: [],
      contradicted: [],
      worthWriting: null,
      idle: [],
      filed: { byRule: 0, total: 0 },
    });
  });

  it('reports a rule that names what is gone, and no other trouble with it', async () => {
    const health = await load(
      serviceWith({
        owned: false,
        rules: [rule({ lastMatchedAt: daysAgo(400) })],
        rows: [row(), row(), row()],
      }),
    );
    expect(health.broken).toEqual([{ id: 'rule-1', name: 'Store' }]);
    expect(health.contradicted).toEqual([]);
    expect(health.idle).toEqual([]);
  });

  it('counts hand corrections against the rule that would file the row', async () => {
    const health = await load(serviceWith({ rows: [row(), row(), row()] }));
    expect(health.contradicted).toEqual([{ id: 'rule-1', name: 'Store', count: 3 }]);
  });

  it.each([
    ['too few corrections', [row(), row()]],
    ['the same category the rule gives', [row(), row(), row({ categoryId: 'food' })]],
    ['a row older than the rule', [row(), row(), row({ createdAt: daysAgo(200) })]],
    ['a private row', [row(), row(), row({ isPrivate: true })]],
    ['a row the rule does not match', [row(), row(), row({ counterpartyName: 'Other' })]],
  ])('does not call it a dispute with %s', async (_, rows) => {
    expect((await load(serviceWith({ rows }))).contradicted).toEqual([]);
  });

  it('offers the suggestions this person did not wave away', async () => {
    const suggestion = (payeeId: string, payeeName: string, decidedCount: number) => ({
      payeeId,
      payeeName,
      decidedCount,
    });
    const health = await load(
      serviceWith({
        suggestions: [suggestion('p1', 'Waved', 9), suggestion('p2', STORE, 6), suggestion('p3', 'Gym', 3)],
        dismissed: ['p1'],
      }),
    );
    expect(health.worthWriting).toEqual({ count: 2, payee: STORE, decided: 6 });
  });

  it('calls a rule idle after 30 days with no first match or 180 without another', async () => {
    const health = await load(
      serviceWith({
        rules: [
          rule({ id: 'new', lastMatchedAt: null, createdAt: daysAgo(40) }),
          rule({ id: 'old', lastMatchedAt: daysAgo(200) }),
          rule({ id: 'fresh', lastMatchedAt: null, createdAt: daysAgo(10) }),
          rule({ id: 'busy', lastMatchedAt: daysAgo(100) }),
        ],
      }),
    );
    expect(health.idle.map(item => [item.id, item.months])).toEqual([
      ['old', 6],
      ['new', 1],
    ]);
  });

  it('calls nothing idle while no rows arrive', async () => {
    const health = await load(
      serviceWith({ recentRows: 19, rules: [rule({ lastMatchedAt: daysAgo(400) })] }),
    );
    expect(health.idle).toEqual([]);
  });

  it('reads the share of the month filed by rules', async () => {
    const health = await load(serviceWith({ filed: { total: '40', byRule: '30' } }));
    expect(health.filed).toEqual({ byRule: 30, total: 40 });
  });
});
