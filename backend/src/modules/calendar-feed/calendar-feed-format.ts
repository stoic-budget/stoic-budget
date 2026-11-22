import { APP_SLUG } from '../../common/brand';
import { formatMoney } from '../notifications/notification-params';
import type { CalendarFeedLabels } from './calendar-feed-translations';

/** Days back a paid (or still unpaid) item stays in the feed, so paid things do not vanish at once. */
export const FEED_PAST_DAYS = 60;
/** Days ahead the feed reaches for items that exist. */
export const FEED_AHEAD_DAYS = 365;
/** Days ahead repeating bills and subscription charges are projected. */
export const FEED_PROJECTION_DAYS = 180;
/** At most this many rows of one kind: a calendar app is not a ledger. */
export const FEED_MAX_ROWS = 2000;

/** Who reads the feed, in which language, and what day it is for them. */
export interface FeedContext {
  workspaceId: string;
  memberId: string;
  locale: string;
  labels: CalendarFeedLabels;
  /** `YYYY-MM-DD`. */
  today: string;
}

/** A label template with its `{{placeholders}}` filled in. */
export function fillLabel(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

/** An amount in its own currency, in the reader's language. */
export function feedMoney(context: FeedContext, amount: number, currency: string): string {
  return formatMoney(Math.abs(amount), currency, context.locale);
}

/**
 * A UID that is the same on every fetch: built from what the event shows, not
 * from the request. The workspace is part of it, since a restored copy of a
 * workspace keeps some ids (a series) of the original.
 */
export function feedUid(context: FeedContext, ...parts: string[]): string {
  return `${parts.join('-')}.${context.workspaceId}@${APP_SLUG}`;
}
