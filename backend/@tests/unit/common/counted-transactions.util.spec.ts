import {
  countedSql,
  countedWhere,
  flowsSql,
  onlyCounted,
  onlyFlows,
} from '@/common/utils/counted-transactions.util';

/** A query builder that only remembers its `andWhere` clauses. */
function recorder() {
  const clauses: string[] = [];
  const query = {
    andWhere(where: string) {
      clauses.push(where);
      return query;
    },
  };
  return { query, clauses };
}

describe('counted transactions', () => {
  describe('rows left out of budgets', () => {
    it('drop out of every income and spending figure built with onlyFlows', () => {
      const { query, clauses } = recorder();

      onlyFlows(query, 't');

      expect(clauses).toContain('t.excludedFromBudgets = false');
    });

    it('drop out of data-health counts too, which still look at unconfirmed rows', () => {
      const { query, clauses } = recorder();

      onlyFlows(query, 't', { includeUnconfirmed: true });

      expect(clauses).toContain('t.excludedFromBudgets = false');
      expect(clauses).not.toContain('t.isVerified = true');
    });

    it('drop out of raw flows SQL, by column name and alias', () => {
      expect(flowsSql('tx')).toContain('tx.excluded_from_budgets = false');
    });

    it('keep counting in balances and net worth (onlyCounted, countedSql, countedWhere)', () => {
      const { query, clauses } = recorder();

      onlyCounted(query, 't');

      expect(clauses.join(' ')).not.toMatch(/excluded/i);
      expect(countedSql('t')).not.toMatch(/excluded/i);
      for (const where of countedWhere({ workspaceId: 'ws-1' })) {
        expect(where).not.toHaveProperty('excludedFromBudgets');
      }
    });
  });
});
