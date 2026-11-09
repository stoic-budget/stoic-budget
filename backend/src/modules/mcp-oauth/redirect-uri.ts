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

/** Exact string comparison: no normalising, no prefix or port wildcards. */
export const isRegisteredRedirect = (registered: readonly string[], requested: string): boolean =>
  registered.includes(requested);

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
