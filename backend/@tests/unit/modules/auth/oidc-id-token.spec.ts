import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import type { JSONWebKeySet } from 'jose';
import { verifyIdToken } from '../../../../src/modules/auth/oidc/oidc-id-token';
import { OidcRefusal } from '../../../../src/modules/auth/oidc/oidc-refusal';

const ISSUER = 'https://login.example.com';
const CLIENT = 'stoic-client';
const NONCE = 'nonce-123';
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

const claims = (extra: Record<string, unknown> = {}) => ({
  iss: ISSUER,
  aud: CLIENT,
  sub: 'subject-1',
  exp: now() + 300,
  iat: now(),
  nonce: NONCE,
  email: 'Member-1@Example.com',
  email_verified: true,
  ...extra,
});

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const rsaJwk = { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'rsa-1', alg: 'RS256' };
const rs256 = (payload: object, kid = 'rsa-1') => {
  const input = `${b64({ alg: 'RS256', kid })}.${b64(payload)}`;
  return `${input}.${sign('sha256', Buffer.from(input), rsa.privateKey).toString('base64url')}`;
};

/**
 * A provider whose key set (by mistake or on purpose) publishes a symmetric
 * key: anyone who reads the set can sign with it. Two layers refuse it: our
 * algorithm allow-list, and jose, which takes no HMAC algorithm from a key set.
 */
const sharedSecret = 'published-symmetric-secret';
const octJwk = { kty: 'oct', kid: 'oct-1', k: Buffer.from(sharedSecret).toString('base64url') };
const hs256 = (payload: object) => {
  const input = `${b64({ alg: 'HS256', kid: 'oct-1' })}.${b64(payload)}`;
  return `${input}.${createHmac('sha256', sharedSecret).update(input).digest('base64url')}`;
};

const expectations = (sets: JSONWebKeySet[]) => {
  const calls: boolean[] = [];
  return {
    calls,
    value: {
      issuer: ISSUER,
      clientId: CLIENT,
      nonce: NONCE,
      keys: async (fresh: boolean) => {
        calls.push(fresh);
        return sets[Math.min(calls.length - 1, sets.length - 1)];
      },
    },
  };
};

const refused = async (promise: Promise<unknown>) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(OidcRefusal);
  expect((error as OidcRefusal).code).toBe('OIDC_TOKEN_INVALID');
};

describe('verifyIdToken', () => {
  it('answers the subject and a lower-cased, verified e-mail', async () => {
    const { value } = expectations([{ keys: [rsaJwk] }]);
    await expect(verifyIdToken(rs256(claims()), value)).resolves.toEqual({
      subject: 'subject-1',
      email: 'member-1@example.com',
      emailVerified: true,
      name: null,
    });
  });

  it('refuses an HMAC token even when the key set holds the symmetric key', async () => {
    const { value } = expectations([{ keys: [rsaJwk, octJwk] as JSONWebKeySet['keys'] }]);
    await refused(verifyIdToken(hs256(claims()), value));
  });

  it('refuses an unsigned token', async () => {
    const { value } = expectations([{ keys: [rsaJwk] }]);
    await refused(verifyIdToken(`${b64({ alg: 'none' })}.${b64(claims())}.`, value));
  });

  it('refetches the keys once for an unknown key id, and only once', async () => {
    const first = expectations([{ keys: [] }, { keys: [rsaJwk] }]);
    await expect(verifyIdToken(rs256(claims()), first.value)).resolves.toMatchObject({
      subject: 'subject-1',
    });
    expect(first.calls).toEqual([false, true]);

    const never = expectations([{ keys: [] }]);
    await refused(verifyIdToken(rs256(claims()), never.value));
    expect(never.calls).toEqual([false, true]);
  });

  it('counts only a boolean true as a verified e-mail', async () => {
    const { value } = expectations([{ keys: [rsaJwk] }]);
    for (const emailVerified of ['true', 1, undefined]) {
      const result = await verifyIdToken(rs256(claims({ email_verified: emailVerified })), value);
      expect(result.emailVerified).toBe(false);
    }
  });

  it('refuses an issue time in the future', async () => {
    const { value } = expectations([{ keys: [rsaJwk] }]);
    await refused(verifyIdToken(rs256(claims({ iat: now() + 3600, exp: now() + 7200 })), value));
  });

  it('refuses a token without a subject', async () => {
    const { value } = expectations([{ keys: [rsaJwk] }]);
    await refused(verifyIdToken(rs256(claims({ sub: '' })), value));
  });
});
