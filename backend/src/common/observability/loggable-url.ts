/** What `loggableUrl` reads off a request: Express sets `route` once a route matched. */
interface LoggedRequest {
  url?: string;
  baseUrl?: string;
  route?: { path?: string };
}

/** A path under `/public/` (any prefix before it): the link's secret follows. */
const PUBLIC_PATH = /^(.*?\/public)\//;

/**
 * The url a log line may carry. A public link holds its secret in the path (a
 * calendar feed, a shared invoice or table, an invitation), so for a public
 * route (marked `@Public()`, under `/public/`, or taking a `:token`) the log
 * gets the route pattern, `/public/calendar/:token.ics`, never the token.
 * Without a matched route only the part before the secret is kept.
 */
export function loggableUrl(request: LoggedRequest, isPublic = false): string {
  const url = request.url ?? '';
  const routePath = request.route?.path;
  if (!(isPublic || PUBLIC_PATH.test(url) || routePath?.includes(':token'))) return url;
  if (routePath) return `${request.baseUrl ?? ''}${routePath}`;
  const prefix = PUBLIC_PATH.exec(url)?.[1];
  return prefix ? `${prefix}/…` : '(public route)';
}
