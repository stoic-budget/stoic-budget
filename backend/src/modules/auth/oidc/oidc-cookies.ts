import type { CookieOptions, Request, Response } from 'express';

/** Ties a sign-in or link to the browser that started it. */
export const OIDC_FLOW_COOKIE = 'oidc_flow';
/** A checked sign-in waiting for `POST /auth/oidc/complete` (and the second factor). */
export const OIDC_TICKET_COOKIE = 'oidc_ticket';
/** A fresh provider sign-in waiting for `POST /auth/password/set`. */
export const OIDC_STEP_UP_COOKIE = 'oidc_step_up';

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * HttpOnly, and `lax` whatever AUTH_COOKIE_SAMESITE says unless it is `none`:
 * the provider sends the browser back with a cross-site top-level GET, which
 * `strict` would send without this cookie, and the sign-in would always fail.
 */
const options = (): CookieOptions => {
  const none = process.env.AUTH_COOKIE_SAMESITE?.toLowerCase() === 'none';
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || none,
    sameSite: none ? 'none' : 'lax',
    path: '/',
    ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
  };
};

export function setOidcCookie(
  res: Response,
  name: string,
  value: string,
  maxAge = TEN_MINUTES_MS,
): void {
  res.cookie(name, value, { ...options(), maxAge });
}

export function clearOidcCookie(res: Response, name: string): void {
  res.clearCookie(name, options());
}

export function readOidcCookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : undefined;
}
