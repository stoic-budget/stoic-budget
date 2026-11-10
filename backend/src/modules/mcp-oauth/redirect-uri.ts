/** Hosts a native client listens on (RFC 8252 §7.3); plain http is allowed only there. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_LENGTH = 2000;
/** Whitespace, control characters and backslashes: parsers disagree on them. */
const hasUnsafeCharacter = (value: string): boolean =>
  /[\s\\]/.test(value) ||
  [...value].some(char => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

/**
 * Why `uri` cannot be a redirect URI, or null when it can: absolute https, or
 * http on a loopback host, with no user info and no fragment.
 */
export function redirectUriProblem(uri: string): string | null {
  if (uri.length === 0 || uri.length > MAX_LENGTH || hasUnsafeCharacter(uri)) {
    return 'malformed';
  }
  if (uri.includes('#')) {
    return 'fragment';
  }
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return 'malformed';
  }
  const loopback = parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname);
  if (!(parsed.protocol === 'https:' || loopback)) {
    return 'scheme';
  }
  if (parsed.username || parsed.password) {
    return 'userinfo';
  }
  return parsed.hostname ? null : 'malformed';
}

/**
 * The start of a loopback http URI as typed: host, optional port, then a path,
 * a query or the end. Matched on the raw text, so anything a URL parser would
 * rewrite (case, user info, a backslash) does not match and stays exact-only.
 */
const LOOPBACK_PREFIX = /^http:\/\/(127\.0\.0\.1|\[::1\]|localhost)(?::\d{1,5})?(?=[/?]|$)/;

/** A loopback http redirect URI with its port taken out, or null for any other URI. */
function withoutLoopbackPort(uri: string): string | null {
  const match = redirectUriProblem(uri) === null ? LOOPBACK_PREFIX.exec(uri) : null;
  return match ? `http://${match[1]}${uri.slice(match[0].length)}` : null;
}

/**
 * Exact string comparison, no normalising and no prefix wildcards, with one
 * exception: a native app listens on whatever port it got (RFC 8252 §7.3), so
 * for http on 127.0.0.1, [::1] or localhost the port may differ. Scheme, host,
 * path and query still match exactly, and one loopback name never stands in
 * for another.
 */
export function isRegisteredRedirect(registered: readonly string[], requested: string): boolean {
  if (registered.some(uri => uri === requested)) {
    return true;
  }
  const portless = withoutLoopbackPort(requested);
  return portless !== null && registered.some(uri => withoutLoopbackPort(uri) === portless);
}

/** `uri` with `params` added to its query, the ones left undefined skipped. */
export function redirectWith(uri: string, params: Record<string, string | undefined>): string {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return url.href;
}

/** What the consent screen shows: where the browser will be sent. */
export const redirectHost = (uri: string): string => new URL(uri).host;
