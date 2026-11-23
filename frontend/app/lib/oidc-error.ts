import { translateErrorCode } from './api-error';

/**
 * The text for a single sign-on failure the API sent back in the URL. Only our
 * own codes are looked up: the query string is anyone's to write, so anything
 * else shows the plain fallback rather than text taken from the link.
 */
export function oidcErrorMessage(code: string | null, fallback: string): string | null {
  if (!code) return null;
  if (!/^(OIDC_[A-Z_]+|AUTH_ACCOUNT_INACTIVE|AUTH_PASSWORD_ALREADY_SET)$/.test(code))
    return fallback;
  return translateErrorCode(code, undefined) ?? fallback;
}
