import { ForecastService } from '../../../../src/modules/forecast/forecast.service';
import {
  incomeHistory,
  pendingEvents,
} from '../../../../src/modules/forecast/forecast-transactions';

/**
 * A query builder that keeps TypeORM's where semantics: `where()` replaces
 * every condition set before it, `andWhere()` adds one. A filter added before
 * `where()` is lost, exactly as in TypeORM.
 */
function recordingQuery(result: unknown) {
  const conditions: string[] = [];
  const query: any = {
    conditions,
    getRawMany: vi.fn(async () => result),
    getRawOne: vi.fn(async () => result),
  };
  for (const method of [
    'innerJoin',
    'select',
    'addSelect',
    'setParameters',
    'groupBy',
    'addGroupBy',
    'orderBy',
  ]) {
    query[method] = vi.fn(() => query);
  }
  query.where = vi.fn((sql: string) => {
    conditions.splice(0, conditions.length, sql);
    return query;
  });
  query.andWhere = vi.fn((sql: string) => {
    conditions.push(sql);
    return query;
  });
  return query;
}

describe('ForecastService history', () => {
  const build = () => {
    const queries: any[] = [];
    const transactionRepository = {
      createQueryBuilder: vi.fn(() => {
        const query = recordingQuery(queries.length === 1 ? { first: null } : []);
        queries.push(query);
        return query;
      }),
    };
    const service = new ForecastService(
      transactionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getRateOrNull: vi.fn(async () => 1) } as any,
    );
    return { service, queries };
  };

  it('averages income and expense over confirmed transactions only', async () => {
    const { service, queries } = build();

    await (service as any).monthlyHistory('ws-1', 'EUR', new Date('2026-10-04'));

    const [history, earliest] = queries;
    expect(history.conditions).toContain('t.isVerified = true');
    expect(history.conditions).toContain('t.workspaceId = :workspaceId');
    expect(earliest.conditions).toContain('t.isVerified = true');
  });

  it('learns recurring income from confirmed transactions only', async () => {
    const { service, queries } = build();

    await incomeHistory((service as any).transactionRepository, 'ws-1', new Date('2026-10-04'), null);

    expect(queries[0].conditions).toContain('t.isVerified = true');
    expect(queries[0].conditions).toContain('t.workspaceId = :workspaceId');
  });
});

describe('ForecastService pending rows', () => {
  const repositoryWith = (rows: unknown[]) => {
    const query = recordingQuery(rows);
    return { query, repository: { createQueryBuilder: vi.fn(() => query) } as any };
  };
  const asIs = async (amount: number) => amount;

  it('places each pending row on today as money already gone or come', async () => {
    const { repository } = repositoryWith([
      { id: 'p-1', label: 'ACME Store - Wireless Buds', currency: 'EUR', type: 'expense', amount: '15.00' },
      { id: 'p-2', label: 'ACME Refunds', currency: 'EUR', type: 'income', amount: '4.50' },
    ]);

    const events = await pendingEvents(repository, 'ws-1', '2026-10-04', null, asIs);

    expect(events).toEqual([
      { date: '2026-10-04', label: 'ACME Store - Wireless Buds', amount: -15, kind: 'pending', sourceId: 'p-1' },
      { date: '2026-10-04', label: 'ACME Refunds', amount: 4.5, kind: 'pending', sourceId: 'p-2' },
    ]);
  });

  it('reads only pending rows of the workspace that are no duplicate and not trashed', async () => {
    const { query, repository } = repositoryWith([]);

    await pendingEvents(repository, 'ws-1', '2026-10-04', null, asIs);

    expect(query.conditions).toContain('t.workspaceId = :workspaceId');
    expect(query.conditions).toContain('t.isPending = true AND t.isDuplicate = false');
    expect(query.conditions.join(' ')).toContain('trashed.deleted_at IS NOT NULL');
  });

  it('leaves out holds older than the bank keeps one, which only a pull would remove', async () => {
    const { query, repository } = repositoryWith([]);

    await pendingEvents(repository, 'ws-1', '2026-10-04', null, asIs);

    expect(query.conditions).toContain('t.transactionDate >= :pendingSince');
    const params = query.andWhere.mock.calls.find(
      (call: unknown[]) => call[0] === 't.transactionDate >= :pendingSince',
    )[1];
    expect(params).toEqual({ pendingSince: '2026-09-20' });
  });
});
