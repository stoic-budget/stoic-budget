import type { ParserHealth, ParserHealthBank, SystemHealthLevel } from '@/app/lib/contracts';

/** The levels a summary row can show, worst last. */
export type SummaryLevel = Extract<SystemHealthLevel, 'ok' | 'warning' | 'error'>;

const RANK: Record<SummaryLevel, number> = { ok: 0, warning: 1, error: 2 };

const worst = (levels: readonly SummaryLevel[]): SummaryLevel =>
  levels.reduce<SummaryLevel>((acc, level) => (RANK[level] > RANK[acc] ? level : acc), 'ok');

/** A bank that failed is an error; one with statements held, declined or a new layout is worth a look. */
export function bankLevel(bank: ParserHealthBank): SummaryLevel {
  if (bank.errors > 0) {
    return 'error';
  }
  if (bank.needsReview > 0 || bank.declined > 0 || bank.layouts.some(layout => layout.isNew)) {
    return 'warning';
  }
  return 'ok';
}

/** The worst bank's level: all banks fine is "ok". */
export function parserHealthLevel(health: ParserHealth): SummaryLevel {
  return worst(health.banks.map(bankLevel));
}

/** Banks with a problem first, worst first, then the busiest. */
export function sortBanks(banks: readonly ParserHealthBank[]): ParserHealthBank[] {
  return [...banks].sort(
    (a, b) => RANK[bankLevel(b)] - RANK[bankLevel(a)] || b.statements - a.statements,
  );
}
