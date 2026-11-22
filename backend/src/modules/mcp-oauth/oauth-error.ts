import type { Response } from 'express';

/** Error codes of RFC 6749 §5.2, RFC 7591 §3.2.2, RFC 7009 and RFC 8707. */
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'invalid_target'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  | 'access_denied'
  | 'temporarily_unavailable';

export interface OAuthFailure {
  ok: false;
  status: number;
  error: OAuthErrorCode;
  description: string;
}

export type OAuthResult<T> = { ok: true; value: T } | OAuthFailure;

export const oauthFailure = (
  error: OAuthErrorCode,
  description: string,
  status = 400,
): OAuthFailure => ({ ok: false, status, error, description });

/** Token answers carry credentials: never cached, by anyone (RFC 6749 §5.1). */
export function sendNoStore(response: Response, status: number, body: object): void {
  response.status(status).set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' }).json(body);
}

/** OAuth endpoints answer errors in their own format, not the app's. */
export function sendOAuthResult<T extends object>(
  response: Response,
  result: OAuthResult<T>,
  successStatus = 200,
): void {
  if (result.ok) {
    sendNoStore(response, successStatus, result.value);
    return;
  }
  sendNoStore(response, result.status, {
    error: result.error,
    error_description: result.description,
  });
}
