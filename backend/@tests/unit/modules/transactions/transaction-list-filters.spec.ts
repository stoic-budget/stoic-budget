import type { SelectQueryBuilder } from 'typeorm';
import type { Transaction } from '@/entities/transaction.entity';
import {
  applyListFilters,
  escapeLikePattern,
  listFiltersFromQuery,
} from '@/modules/transactions/transaction-list-filters';

function fakeQuery() {
  const clauses: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  const query = {
    andWhere: (sql: string, params?: Record<string, unknown>) => {
      clauses.push({ sql, params });
      return query;
    },
  };
  return { query: query as unknown as SelectQueryBuilder<Transaction>, clauses };
}

describe('applyListFilters paymentType', () => {
  it('adds no condition when the filter is absent', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, {}, 'member-1');
    expect(clauses).toEqual([]);
  });

  it('filters by the type and hides other members private rows', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { paymentType: 'card' }, 'member-1');
    expect(clauses[0]).toEqual({
      sql: 'transaction.paymentType = :paymentType',
      params: { paymentType: 'card' },
    });
    expect(clauses[1].sql).toContain('transaction.isPrivate = false');
    expect(clauses[1].params).toEqual({ viewerMemberId: 'member-1' });
  });
});

describe('escapeLikePattern', () => {
  it('makes LIKE wildcards and the escape character literal', () => {
    expect(escapeLikePattern('50%_off\\now')).toBe('50\\%\\_off\\\\now');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeLikePattern('ACME Store - Wireless Buds')).toBe('ACME Store - Wireless Buds');
  });
});

describe('applyListFilters search filters', () => {
  const merchant = 'ACME Store';

  it('matches text in the payee, counterparty, purpose and comment of readable rows only', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { q: merchant }, 'member-1');
    expect(clauses).toHaveLength(1);
    const [{ sql, params }] = clauses;
    for (const column of [
      'transaction.counterpartyName ILIKE :q',
      'transaction.paymentPurpose ILIKE :q',
      'transaction.comments ILIKE :q',
      'payee.name ILIKE :q',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain('transaction.isPrivate = false OR transaction.ownerMemberId');
    expect(params).toEqual({ q: `%${merchant}%`, viewerMemberId: 'member-1' });
  });

  it('escapes wildcards in the searched text', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { q: '100%' }, null);
    expect(clauses[0].params?.q).toBe('%100\\%%');
  });

  it('bounds the absolute amount from both sides', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { amountMin: 10, amountMax: 99.5 }, null);
    expect(clauses).toEqual([
      { sql: expect.stringMatching(/^ABS\(.*\) >= :amountMin$/), params: { amountMin: 10 } },
      { sql: expect.stringMatching(/^ABS\(.*\) <= :amountMax$/), params: { amountMax: 99.5 } },
    ]);
  });

  it('keeps a zero bound, which is a real bound', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { amountMin: 0 }, null);
    expect(clauses[0].params).toEqual({ amountMin: 0 });
  });

  it('narrows to any of several categories', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { categoryIds: ['cat-1', 'cat-2'] }, null);
    expect(clauses).toEqual([
      {
        sql: 'transaction.categoryId IN (:...categoryIds)',
        params: { categoryIds: ['cat-1', 'cat-2'] },
      },
    ]);
  });

  it('counts the Uncategorized fallback as uncategorized', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { uncategorized: true }, null);
    expect(clauses[0].sql).toContain('transaction.categoryId IS NULL');
    expect(clauses[0].sql).toContain(':uncategorizedName');
    expect(clauses[0].params).toEqual({ uncategorizedName: 'uncategorized' });
  });

  it('narrows to rows carrying any of the tags, from the workspace’s tag pairs', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { tagIds: ['tag-1', 'tag-2'] }, null);
    expect(clauses[0].sql).toMatch(/^transaction\.id IN \(SELECT tag_pairs\.transaction_id/);
    expect(clauses[0].sql).toContain('tg.workspace_id = :workspaceId');
    expect(clauses[0].sql).toContain('tag_pairs.tag_id IN (:...tagIds)');
    expect(clauses[0].params).toEqual({ tagIds: ['tag-1', 'tag-2'] });
  });

  it('keeps rows carrying no tag at all', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { untagged: true }, null);
    expect(clauses[0].sql).toMatch(/^transaction\.id NOT IN \(SELECT tag_pairs\.transaction_id/);
  });

  it('keeps readable rows without a payee', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { noPayee: true }, 'member-1');
    expect(clauses[0].sql).toContain('transaction.payeeId IS NULL AND');
    expect(clauses[0].sql).toContain('transaction.isPrivate = false');
    expect(clauses[0].params).toEqual({ viewerMemberId: 'member-1' });
  });

  it('adds nothing for toggles that are off or empty lists', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(
      query,
      { uncategorized: false, untagged: false, noPayee: false, tagIds: [], categoryIds: [] },
      null,
    );
    expect(clauses).toEqual([]);
  });

  it('combines every filter, each one narrowing', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(
      query,
      {
        categoryId: 'cat-1',
        categoryIds: ['cat-2'],
        tagIds: ['tag-1'],
        q: merchant,
        amountMin: 1,
        amountMax: 2,
        uncategorized: true,
        untagged: true,
        noPayee: true,
        paymentType: 'card',
      },
      'member-1',
    );
    expect(clauses).toHaveLength(11);
  });
});

describe('listFiltersFromQuery', () => {
  it('passes the new filters through, trimmed', () => {
    const filters = listFiltersFromQuery(
      {
        q: '  ACME  ',
        amountMin: 5,
        amountMax: 50,
        tagIds: ['tag-1'],
        categoryIds: ['cat-1', 'cat-2'],
        uncategorized: true,
        untagged: false,
        noPayee: true,
      },
      null,
    );
    expect(filters).toMatchObject({
      q: 'ACME',
      amountMin: 5,
      amountMax: 50,
      tagIds: ['tag-1'],
      categoryIds: ['cat-1', 'cat-2'],
      uncategorized: true,
      untagged: false,
      noPayee: true,
    });
  });

  it('drops blank text and empty lists', () => {
    const filters = listFiltersFromQuery({ q: '   ', tagIds: [], categoryIds: [] }, null);
    expect(filters.q).toBeUndefined();
    expect(filters.tagIds).toBeUndefined();
    expect(filters.categoryIds).toBeUndefined();
  });
});
