import type { StatementCoverage } from '@/app/lib/contracts';

/** One thing wrong with an account's statements, in the order the card lists them. */
export type CoverageProblem =
  | { kind: 'gap' | 'sinceLast'; key: string; from: string; to: string }
  | {
      kind: 'chain';
      key: string;
      date: string;
      closing: number;
      opening: number;
      statementId: string;
    }
  | {
      kind: 'movement';
      key: string;
      from: string;
      to: string;
      difference: number;
      statementId: string;
    }
  | { kind: 'overlap'; key: string; from: string; to: string; statementId: string }
  | { kind: 'duplicate'; key: string; from: string; fileName: string; statementId: string };

const dayOf = (problem: CoverageProblem): string =>
  'date' in problem ? problem.date : problem.from;

/**
 * The account's problems, the days since its last statement first, then the
 * latest first: what is missing now matters more than what was missing once.
 */
export function coverageProblems(coverage: StatementCoverage): CoverageProblem[] {
  const problems: CoverageProblem[] = [
    ...coverage.gaps.map(({ from, to }) => ({
      kind: 'gap' as const,
      key: `gap:${from}`,
      from,
      to,
    })),
    ...coverage.chainBreaks.map(item => ({
      kind: 'chain' as const,
      key: `chain:${item.toStatementId}`,
      date: item.date,
      closing: item.closing,
      opening: item.opening,
      statementId: item.toStatementId,
    })),
    ...coverage.movementMismatches.map(item => ({
      kind: 'movement' as const,
      key: `movement:${item.statementId}`,
      from: item.from,
      to: item.to,
      difference: item.difference,
      statementId: item.statementId,
    })),
    ...coverage.overlaps.map(item => ({
      kind: 'overlap' as const,
      key: `overlap:${item.statementIds.join(':')}`,
      from: item.from,
      to: item.to,
      statementId: item.statementIds[item.statementIds.length - 1],
    })),
    ...coverage.periods
      .filter(period => period.duplicateOf)
      .map(period => ({
        kind: 'duplicate' as const,
        key: `duplicate:${period.statementId}`,
        from: period.from,
        fileName: period.fileName,
        statementId: period.statementId,
      })),
  ];
  problems.sort((a, b) => dayOf(b).localeCompare(dayOf(a)));
  return coverage.sinceLast
    ? [
        {
          kind: 'sinceLast',
          key: 'sinceLast',
          from: coverage.sinceLast.from,
          to: coverage.sinceLast.to,
        },
        ...problems,
      ]
    : problems;
}
