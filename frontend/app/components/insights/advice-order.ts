import type { Insight } from '@/app/hooks/useInsights';

/** The backend's "serious" line: below it a note is worth reading, not acting on. */
const ATTENTION_PRIORITY = 40;

/** Written by the analyzers into `data`, higher is more important. */
const priorityOf = (item: Insight): number => {
  const priority = item.data?.priority;
  return typeof priority === 'number' ? priority : 0;
};

/** Good news: the user is doing well. */
export const isGoodNews = (item: Insight): boolean =>
  item.type === 'stoic.praise' ||
  item.type === 'pattern.net_worth_milestone' ||
  item.messageKey === 'trend.savings_rate_up';

/** Advice that asks for something; the rest is information and stays without an accent. */
export const needsAttention = (item: Insight): boolean =>
  !isGoodNews(item) && (item.severity !== 'info' || priorityOf(item) >= ATTENTION_PRIORITY);

/** What matters most first; among equals, the newest. */
export const byImportance = (a: Insight, b: Insight): number =>
  priorityOf(b) - priorityOf(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt);
