import {
  CONFIRM_TOKEN_TTL_MS,
  type ConfirmBinding,
  canonicalJson,
  deriveConfirmKey,
  hashArguments,
  hashRows,
  issueConfirmToken,
  sameRows,
  verifyConfirmToken,
} from '@/modules/mcp/confirm/confirm-token';

const key = deriveConfirmKey('test-server-secret');
const now = Date.UTC(2026, 10, 9, 12, 0, 0);
const rows = [
  { id: 'row-a', state: 'cat-1|0' },
  { id: 'row-b', state: '-|0' },
];
const binding: ConfirmBinding = {
  tool: 'set_transactions_category',
  argsHash: hashArguments({ transactionIds: ['row-a', 'row-b'], categoryId: 'cat-2' }),
  workspaceId: 'workspace-1',
  apiKeyId: 'key-1',
  rowsHash: hashRows(rows),
  rows: rows.length,
};
const { token } = issueConfirmToken(key, binding, now);

// The first character: the last one of a base64url MAC carries padding bits a decoder drops.
const flip = (text: string): string => `${text.startsWith('A') ? 'B' : 'A'}${text.slice(1)}`;

describe('confirm token', () => {
  it('confirms the call it was issued for', () => {
    expect(verifyConfirmToken(key, token, binding, now + 1000)).toMatchObject({
      ok: true,
      expiresAt: now + CONFIRM_TOKEN_TTL_MS,
      previewed: { rowsHash: binding.rowsHash, rows: 2 },
    });
  });

  it('carries the previewed rows signed, to compare with the rows worked out again', () => {
    const check = verifyConfirmToken(key, token, binding, now);
    if (!check.ok) throw new Error('expected a valid token');

    expect(sameRows(check.previewed, binding)).toBe(true);
    expect(sameRows(check.previewed, { rowsHash: hashRows([rows[0]]), rows: 1 })).toBe(false);
    expect(
      sameRows(check.previewed, {
        rowsHash: hashRows([rows[0], { id: 'row-b', state: 'cat-9|0' }]),
        rows: 2,
      }),
    ).toBe(false);
    expect(sameRows(check.previewed, { rowsHash: binding.rowsHash, rows: 3 })).toBe(false);
  });

  it.each([
    ['workspace', { workspaceId: 'workspace-2' }, 'invalid'],
    ['API key', { apiKeyId: 'key-2' }, 'invalid'],
    ['tool', { tool: 'approve_transactions' }, 'mismatch'],
    [
      'arguments',
      { argsHash: hashArguments({ transactionIds: ['row-a'], categoryId: 'cat-2' }) },
      'mismatch',
    ],
  ] as const)('refuses another %s', (_field, change, reason) => {
    expect(verifyConfirmToken(key, token, { ...binding, ...change }, now)).toEqual({
      ok: false,
      reason,
    });
  });

  it('refuses a token signed with another key', () => {
    expect(verifyConfirmToken(deriveConfirmKey('other-secret'), token, binding, now)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('refuses a token whose payload or signature was edited', () => {
    const [prefix, body, mac] = token.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    const forge = (change: Record<string, unknown>) =>
      `${prefix}.${Buffer.from(JSON.stringify({ ...payload, ...change })).toString('base64url')}.${mac}`;

    for (const candidate of [
      forge({ exp: payload.exp + 3_600_000 }),
      forge({ t: 'approve_transactions' }),
      forge({ a: hashArguments({}) }),
      forge({ s: hashRows([]) }),
      forge({ n: 0 }),
      forge({ j: 'another-id' }),
      `${prefix}.${body}.${flip(mac)}`,
      `${prefix}.${body}`,
      `other.${body}.${mac}`,
      'not a token',
      '',
    ]) {
      expect(verifyConfirmToken(key, candidate, binding, now)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('expires after ten minutes', () => {
    expect(verifyConfirmToken(key, token, binding, now + CONFIRM_TOKEN_TTL_MS - 1).ok).toBe(true);
    expect(verifyConfirmToken(key, token, binding, now + CONFIRM_TOKEN_TTL_MS)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('gives every token its own id, so spending one leaves the next alone', () => {
    const first = verifyConfirmToken(key, token, binding, now);
    const second = verifyConfirmToken(key, issueConfirmToken(key, binding, now).token, binding, now);

    expect(first.ok && second.ok && first.jti !== second.jti).toBe(true);
  });

  it('derives a key that is not the secret itself', () => {
    expect(key.equals(Buffer.from('test-server-secret'))).toBe(false);
    expect(key).toHaveLength(32);
  });
});

describe('argument hash', () => {
  it('ignores key order and absent keys, not values or list order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
    expect(hashArguments({ a: 1, b: 2 })).toBe(hashArguments({ b: 2, a: 1, c: undefined }));
    expect(hashArguments({ ids: ['x', 'y'] })).not.toBe(hashArguments({ ids: ['y', 'x'] }));
    expect(hashArguments({ categoryId: null })).not.toBe(hashArguments({}));
  });

  it('hashes the affected rows whatever order they come in', () => {
    expect(hashRows([...rows].reverse())).toBe(hashRows(rows));
  });
});
