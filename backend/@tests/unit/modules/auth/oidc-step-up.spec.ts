import { isFreshAuthentication } from '../../../../src/modules/auth/oidc/oidc-step-up.service';

/**
 * auth_time: present, at most five minutes old, not from the future, and not
 * from before the re-authentication started.
 */
describe('isFreshAuthentication', () => {
  const now = 1_800_000_000;
  const times = { now, startedAt: now - 400 };

  it('takes a sign-in from the last five minutes, made after the flow began', () => {
    expect(isFreshAuthentication(now, times)).toBe(true);
    expect(isFreshAuthentication(now - 300, times)).toBe(true);
  });

  it('refuses a missing or older one', () => {
    expect(isFreshAuthentication(null, times)).toBe(false);
    expect(isFreshAuthentication(now - 301, times)).toBe(false);
    expect(isFreshAuthentication(0, times)).toBe(false);
  });

  it('allows a minute of clock skew ahead, no more', () => {
    expect(isFreshAuthentication(now + 60, times)).toBe(true);
    expect(isFreshAuthentication(now + 61, times)).toBe(false);
  });

  it('refuses a sign-in made before the re-authentication started, past a minute of skew', () => {
    const started = { now, startedAt: now - 10 };
    expect(isFreshAuthentication(now - 70, started)).toBe(true);
    expect(isFreshAuthentication(now - 71, started)).toBe(false);
    // Within five minutes of now, yet before the flow: a remembered sign-in.
    expect(isFreshAuthentication(now - 200, started)).toBe(false);
  });
});
