import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Prefixes tell the kinds apart in a log or a leak scan; the rest is 256 random bits. */
export const ACCESS_TOKEN_PREFIX = 'mcp_at_';
export const REFRESH_TOKEN_PREFIX = 'mcp_rt_';
export const CODE_PREFIX = 'mcp_ac_';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const CODE_TTL_SECONDS = 60;

/** The only PKCE method accepted: `plain` would hand the verifier to anyone who sees the request. */
export const PKCE_METHOD = 'S256';

/** RFC 7636 §4.1: 43–128 unreserved characters. */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
/** base64url of a SHA-256 digest, without padding. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export const newSecret = (prefix: string): string =>
  `${prefix}${randomBytes(32).toString('base64url')}`;

/** Tokens and codes are 256-bit random, so a plain SHA-256 is enough to store them by. */
export const hashSecret = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const isCodeChallenge = (value: string): boolean => CHALLENGE.test(value);

/** Whether `verifier` is the one `challenge` was made from (S256 only). */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!(VERIFIER.test(verifier) && CHALLENGE.test(challenge))) {
    return false;
  }
  const expected = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
