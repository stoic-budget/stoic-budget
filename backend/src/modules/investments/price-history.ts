import type { LotMethod } from '../../common/lots/lot-book';
import type { HoldingHistoryPoint, PriceHealth, SecurityCloseSource } from '../../contracts';
import { replayTrades, type TradeEvent } from './trade-ledger';

/**
 * Daily closes and what they say about a holding, kept free of the database
 * so the rules can be read and tested apart from it.
 */

/** Fetches in a row that brought nothing before a symbol reads as stale. */
export const STALE_AFTER_FAILURES = 5;

export interface DatedClose {
  date: string;
  close: number;
  currency: string;
  source: SecurityCloseSource;
}

/**
 * The feed's closes with the workspace's own on top: one close per day, the
 * workspace's where it has one. Both lists may come in any order; the answer
 * is by date.
 */
export function mergeCloses(feed: DatedClose[], own: DatedClose[]): DatedClose[] {
  const byDate = new Map<string, DatedClose>();
  for (const close of feed) byDate.set(close.date, close);
  for (const close of own) byDate.set(close.date, close);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The latest close on or before `date`: a weekend or a holiday keeps Friday's. */
export function closeOn<T extends { date: string }>(closes: T[], date: string): T | null {
  let low = 0;
  let high = closes.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (closes[middle].date <= date) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found >= 0 ? closes[found] : null;
}

export interface FeedHealth {
  consecutiveFailures: number;
  lastCloseOn: string | null;
  lastAttemptAt: Date | null;
}

/**
 * Weekday sessions a feed may go without a newer close before a fetch that
 * brings only old ones counts as silence: a holiday or a late bar is not one.
 */
export const MISSED_SESSIONS_ALLOWED = 3;

/**
 * The feed's state after one fetch. A fetch that brought nothing is a failure.
 * One that brought closes is an answer — a weekend or a holiday brings Friday's
 * again — unless none is newer than the last one and that one is more than a
 * few sessions old: a halted feed keeps answering last month's bars.
 */
export function nextHealth(
  previous: FeedHealth | null,
  fetchedDates: string[] | null,
  now: Date,
): FeedHealth {
  const kept = previous?.lastCloseOn ?? null;
  const failed = {
    consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
    lastCloseOn: kept,
    lastAttemptAt: now,
  };
  if (!fetchedDates || fetchedDates.length === 0) {
    return failed;
  }
  const newest = fetchedDates.reduce((max, date) => (date > max ? date : max));
  const latest = kept && kept > newest ? kept : newest;
  const stuck =
    kept !== null &&
    newest <= kept &&
    sessionsMissed(latest, now.toISOString().slice(0, 10)) > MISSED_SESSIONS_ALLOWED;
  if (stuck) {
    return failed;
  }
  return { consecutiveFailures: 0, lastCloseOn: latest, lastAttemptAt: now };
}

/** Weekdays after `last` and before `today` (today's session may not have closed yet). */
function sessionsMissed(last: string, today: string): number {
  const day = new Date(`${last}T00:00:00.000Z`);
  let missed = 0;
  for (day.setUTCDate(day.getUTCDate() + 1); day.toISOString().slice(0, 10) < today; ) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) missed += 1;
    if (missed > MISSED_SESSIONS_ALLOWED) break;
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return missed;
}

/**
 * The status one workspace sees. A close of its own newer than the feed's
 * last one stands in for the feed in this workspace, so it clears `stale`
 * here and nowhere else.
 */
export function healthView(feed: FeedHealth | null, ownLatest: string | null): PriceHealth {
  const feedLast = feed?.lastCloseOn ?? null;
  const ownIsNewer = ownLatest !== null && (feedLast === null || ownLatest > feedLast);
  const lastCloseOn = ownIsNewer ? ownLatest : feedLast;
  const failures = feed?.consecutiveFailures ?? 0;
  const status =
    failures >= STALE_AFTER_FAILURES && !ownIsNewer ? 'stale' : lastCloseOn ? 'ok' : 'pending';
  return { status, lastCloseOn, failures };
}

export interface LedgerState {
  date: string;
  quantity: number;
  costBasis: number;
}

/**
 * Units held and their cost at the end of every day a trade happened on.
 * Between those days nothing changes, so a daily series reads the latest
 * state on or before each day.
 */
export function ledgerStates(trades: TradeEvent[], method: LotMethod): LedgerState[] {
  const dates = [...new Set(trades.map(trade => trade.date))].sort();
  return dates.map(date => {
    const ledger = replayTrades(
      trades.filter(trade => trade.date <= date),
      method,
    );
    return { date, quantity: ledger.quantity, costBasis: ledger.costBasis };
  });
}

/** `amount` of `currency` in the series' currency on `date`; null without a rate. */
export type Convert = (amount: number, currency: string, date: string) => number | null;

/**
 * One holding, day by day. The close is the latest one on or before the day,
 * converted on that day. With trades (`states`), the value is what was held
 * that day at that close — units as they were then, since the closes are as
 * quoted then — and the gain is that value less the cost of what was held.
 * Without trades only the close is known: the quantity typed in today says
 * nothing about last year.
 */
export function holdingSeries(input: {
  days: string[];
  closes: DatedClose[];
  states: LedgerState[] | null;
  convert: Convert;
}): HoldingHistoryPoint[] {
  return input.days.map(date => {
    const quote = closeOn(input.closes, date);
    const close = quote ? input.convert(quote.close, quote.currency, date) : null;
    if (!input.states) {
      return {
        date,
        close: close === null ? null : round(close, 6),
        quantity: null,
        value: null,
        costBasis: null,
        unrealizedGain: null,
      };
    }
    const state = closeOn(input.states, date);
    const quantity = state?.quantity ?? 0;
    const costBasis = state?.costBasis ?? 0;
    const value = close === null ? null : quantity === 0 ? 0 : quantity * close;
    return {
      date,
      close: close === null ? null : round(close, 6),
      quantity,
      value: value === null ? null : round(value, 2),
      costBasis: round(costBasis, 2),
      unrealizedGain: value === null ? null : round(value - costBasis, 2),
    };
  });
}

/**
 * What a set of holdings with trades was worth on `date`, or null when one of
 * them held units that day without a close to value them at.
 */
export function pricedValueOn(
  holdings: Array<{ states: LedgerState[]; closes: DatedClose[] }>,
  date: string,
  convert: Convert,
): number | null {
  let total = 0;
  for (const holding of holdings) {
    const quantity = closeOn(holding.states, date)?.quantity ?? 0;
    if (quantity === 0) continue;
    const quote = closeOn(holding.closes, date);
    const close = quote ? convert(quote.close, quote.currency, date) : null;
    if (close === null) return null;
    total += quantity * close;
  }
  return round(total, 2);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
