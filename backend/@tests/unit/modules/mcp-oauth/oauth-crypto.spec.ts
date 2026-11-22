import { createHash } from 'node:crypto';
import {
  ACCESS_TOKEN_PREFIX,
  hashSecret,
  isCodeChallenge,
  newSecret,
  verifyPkce,
} from '../../../../src/modules/mcp-oauth/oauth-crypto';

const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

describe('PKCE (S256 only)', () => {
  // The example pair from RFC 7636 appendix B.
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  it('accepts the verifier the challenge was made from', () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it('refuses another verifier', () => {
    expect(verifyPkce(`${verifier.slice(0, -1)}A`, challenge)).toBe(false);
  });

  it('refuses the plain method: the verifier sent as its own challenge', () => {
    expect(isCodeChallenge(verifier)).toBe(true);
    expect(verifyPkce(verifier, verifier)).toBe(false);
  });

  it('refuses verifiers outside 43–128 unreserved characters', () => {
    const short = 'a'.repeat(42);
    const long = 'a'.repeat(129);
    const spaced = `${'a'.repeat(42)} `;
    for (const bad of [short, long, spaced, `${'a'.repeat(42)}+`]) {
      expect(verifyPkce(bad, challengeOf(bad))).toBe(false);
    }
    const longest = 'a'.repeat(128);
    expect(verifyPkce(longest, challengeOf(longest))).toBe(true);
  });

  it('refuses a challenge that is not a base64url SHA-256 digest', () => {
    expect(isCodeChallenge(`${challenge}=`)).toBe(false);
    expect(isCodeChallenge(challenge.slice(1))).toBe(false);
    expect(isCodeChallenge(`${challenge.slice(1)}+`)).toBe(false);
    expect(verifyPkce(verifier, `${challenge}=`)).toBe(false);
  });
});

describe('token secrets', () => {
  it('are prefixed, 256-bit and never repeat', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newSecret(ACCESS_TOKEN_PREFIX)));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^mcp_at_[A-Za-z0-9_-]{43}$/);
    }
  });

  it('are stored as their SHA-256 hex, never as themselves', () => {
    const token = newSecret(ACCESS_TOKEN_PREFIX);
    const hash = hashSecret(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).not.toContain(token.slice(7));
    expect(hashSecret(`${token}x`)).not.toBe(hash);
  });
});
