import { describe, expect, it } from 'vitest';
import type { StatementCoverage } from '@/app/lib/contracts';
import { coverageProblems } from './coverage-problems';

const base: StatementCoverage = {
  walletId: 'w-1',
  currency: 'EUR',
  firstDay: '2026-01-01',
  lastDay: '2026-04-30',
  periods: [],
  gaps: [],
  sinceLast: null,
  overlaps: [],
  chainBreaks: [],
  movementMismatches: [],
  unexplained: 0,
  months: [],
};

describe('coverageProblems', () => {
  it('puts the days since the last statement first, then the latest problem first', () => {
    const problems = coverageProblems({
      ...base,
      sinceLast: { from: '2026-05-01', to: '2026-05-10', days: 10 },
      gaps: [{ from: '2026-02-01', to: '2026-02-28', days: 28 }],
      overlaps: [{ from: '2026-04-01', to: '2026-04-05', days: 5, statementIds: ['mar', 'apr'] }],
      periods: [
        {
          statementId: 'copy',
          fileName: 'january-again.pdf',
          from: '2026-01-01',
          to: '2026-01-31',
          inferred: false,
          source: 'manual',
          status: 'completed',
          balanceStart: null,
          balanceEnd: null,
          counted: 0,
          pending: 0,
          rowCount: 0,
          duplicateOf: { statementId: 'jan', kind: 'same_file' },
        },
      ],
    });
    expect(problems.map(problem => problem.kind)).toEqual(['sinceLast', 'overlap', 'gap', 'duplicate']);
    expect(problems[1]).toMatchObject({ statementId: 'apr' });
    expect(problems[3]).toMatchObject({ statementId: 'copy', fileName: 'january-again.pdf' });
  });

  it('is empty when nothing is wrong', () => {
    expect(coverageProblems(base)).toEqual([]);
  });
});
