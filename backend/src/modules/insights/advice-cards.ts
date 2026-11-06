import type { InsightCandidate } from './analyzers/analyzer.interface';

/** The page is advice, not a report: this many cards, however much the data supports. */
export const MAX_ADVICE_CARDS = 7;

const priorityOf = (candidate: InsightCandidate): number => {
  const priority = candidate.data?.priority;
  return typeof priority === 'number' ? priority : 0;
};

/**
 * What the Advice page shows out of everything the analyzers found: the most
 * important first, up to the cap. "Most spending has no limit" already opens
 * the form for the largest category, so the card naming that category goes.
 */
export function chooseAdviceCards(
  financial: InsightCandidate[],
  stoic: InsightCandidate[],
): InsightCandidate[] {
  const saysItAlready = stoic.some(candidate => candidate.messageKey === 'stoic.unbudgeted_share');
  return [
    ...financial.filter(
      candidate => !(saysItAlready && candidate.messageKey === 'pattern.unbudgeted_top_category'),
    ),
    ...stoic,
  ]
    .sort((a, b) => priorityOf(b) - priorityOf(a))
    .slice(0, MAX_ADVICE_CARDS);
}
