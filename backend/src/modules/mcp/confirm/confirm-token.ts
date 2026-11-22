import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/** How long a preview's token can be confirmed. */
export const CONFIRM_TOKEN_TTL_MS = 10 * 60 * 1000;

const PREFIX = 'mcpc1';

/** The call a confirm token is for, and who makes it. */
export interface CallBinding {
  tool: string;
  /** `hashArguments` of the call without its token. */
  argsHash: string;
  workspaceId: string;
  apiKeyId: string;
}

/** The rows the call changes, with their state before. */
export interface RowsBinding {
  /** `hashRows` of those rows. */
  rowsHash: string;
  rows: number;
}

export type ConfirmBinding = CallBinding & RowsBinding;

interface TokenPayload {
  t: string;
  a: string;
  s: string;
  n: number;
  exp: number;
  j: string;
}

export type ConfirmTokenCheck =
  | { ok: true; jti: string; expiresAt: number; previewed: RowsBinding }
  | { ok: false; reason: 'invalid' | 'expired' | 'mismatch' };

/**
 * The signing key, derived from the server secret for this purpose alone, so
 * a token is never a value the JWT secret signs for anything else.
 */
export const deriveConfirmKey = (secret: string): Buffer =>
  Buffer.from(hkdfSync('sha256', secret, 'mcp-confirm', 'mcp-confirm-token/v1', 32));

/** JSON with object keys sorted at every depth: the same arguments always hash the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('base64url');

export const hashArguments = (args: Record<string, unknown>): string => sha256(canonicalJson(args));

/** The affected rows, each with the state the preview showed, in a stable order. */
export const hashRows = (rows: ReadonlyArray<{ id: string; state: string }>): string =>
  sha256(
    rows
      .map(row => `${row.id}=${row.state}`)
      .sort()
      .join('\n'),
  );

const sign = (key: Buffer, body: string, binding: CallBinding): Buffer =>
  createHmac('sha256', key).update(`${body}|${binding.workspaceId}|${binding.apiKeyId}`).digest();

export function issueConfirmToken(
  key: Buffer,
  binding: ConfirmBinding,
  now: number = Date.now(),
): { token: string; expiresAt: number } {
  const expiresAt = now + CONFIRM_TOKEN_TTL_MS;
  const payload: TokenPayload = {
    t: binding.tool,
    a: binding.argsHash,
    s: binding.rowsHash,
    n: binding.rows,
    exp: expiresAt,
    j: randomBytes(16).toString('base64url'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = sign(key, body, binding).toString('base64url');
  return { token: `${PREFIX}.${body}.${mac}`, expiresAt };
}

const readPayload = (body: string): TokenPayload | null => {
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const valid =
      typeof parsed?.t === 'string' &&
      typeof parsed.a === 'string' &&
      typeof parsed.s === 'string' &&
      typeof parsed.n === 'number' &&
      typeof parsed.exp === 'number' &&
      typeof parsed.j === 'string';
    return valid ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Checks a token against the call being made now, before anything is read
 * from the database. The signature covers the workspace and the key, so a
 * token from another one is simply invalid; the rest is compared field by
 * field to say what to do about it. The rows the preview showed come back
 * signed, for `sameRows` once they are worked out again.
 */
export function verifyConfirmToken(
  key: Buffer,
  token: string,
  current: CallBinding,
  now: number = Date.now(),
): ConfirmTokenCheck {
  const [prefix, body, mac, ...rest] = token.split('.');
  if (prefix !== PREFIX || !body || !mac || rest.length > 0) {
    return { ok: false, reason: 'invalid' };
  }
  const expected = sign(key, body, current);
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'invalid' };
  }
  const payload = readPayload(body);
  if (!payload) {
    return { ok: false, reason: 'invalid' };
  }
  if (now >= payload.exp) {
    return { ok: false, reason: 'expired' };
  }
  if (payload.t !== current.tool || payload.a !== current.argsHash) {
    return { ok: false, reason: 'mismatch' };
  }
  return {
    ok: true,
    jti: payload.j,
    expiresAt: payload.exp,
    previewed: { rowsHash: payload.s, rows: payload.n },
  };
}

/** Whether the rows a call changes now are the ones its preview showed. */
export const sameRows = (previewed: RowsBinding, now: RowsBinding): boolean =>
  previewed.rowsHash === now.rowsHash && previewed.rows === now.rows;
