import { parseMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { currentMonthKey } from '@/app/components/dashboard/month-end';

/**
 * `?asOf=YYYY-MM`: the page was opened from the dashboard while it showed that
 * month, and shows that month too. It only marks the link; each page reads its
 * own period from its own parameters. The app warns under it that the figures
 * are not the present (PastMonthBanner).
 */
export const AS_OF_PARAM = 'asOf';

/**
 * The marked month, when it is a valid one other than the month we are in
 * (`present`: by default the calendar month; pages pass the workspace's, see
 * `usePresentPeriod`).
 */
export function readAsOf(
  value: string | null | undefined,
  present: string = currentMonthKey(),
): string | null {
  return value && parseMonthParam(value) && value !== present ? value : null;
}

/** `href` marked with the dashboard's month; unchanged for the current month (`present`). */
export function withAsOf(href: string, month: string | null | undefined, present?: string): string {
  const asOf = readAsOf(month, present);
  if (!asOf) {
    return href;
  }
  const [path, hash] = href.split('#');
  const marked = `${path}${path.includes('?') ? '&' : '?'}${AS_OF_PARAM}=${asOf}`;
  return hash === undefined ? marked : `${marked}#${hash}`;
}
