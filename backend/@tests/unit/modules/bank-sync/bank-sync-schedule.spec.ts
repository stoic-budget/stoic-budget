import {
  BankSyncAuthError,
  BankSyncTemporaryError,
} from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import {
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  backoffDelayMs,
  byWorkspace,
  failureOf,
  jitterFactor,
  MANUAL_COOLDOWN_MS,
  manualWaitSeconds,
  nextPullForInterval,
  parseRetryAfter,
  RETRY_AFTER_CAP_MS,
  retryAtAfterFailure,
  scheduleOf,
} from '../../../../src/modules/bank-sync/bank-sync-schedule';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-11-10T12:00:00.000Z');
/** The middle of the jitter range: no jitter at all. */
const middle = () => 0.5;
const lowest = () => 0;
const highest = () => 0.999999;

describe('bank-sync backoff', () => {
  it('doubles from half an hour after each failure in a row', () => {
    expect(backoffDelayMs(1, middle)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(2, middle)).toBe(2 * BACKOFF_BASE_MS);
    expect(backoffDelayMs(3, middle)).toBe(4 * BACKOFF_BASE_MS);
    expect(backoffDelayMs(6, middle)).toBe(16 * HOUR);
  });

  it('stops at a day however long the provider stays down', () => {
    expect(backoffDelayMs(7, middle)).toBe(BACKOFF_CAP_MS);
    expect(backoffDelayMs(40, middle)).toBe(BACKOFF_CAP_MS);
    // 2 ** 2000 is Infinity: still a day, not a never.
    expect(backoffDelayMs(2000, middle)).toBe(BACKOFF_CAP_MS);
    // Jitter on top of the cap never pushes past it.
    expect(backoffDelayMs(40, highest)).toBeLessThanOrEqual(BACKOFF_CAP_MS);
  });

  it('spreads retries by ten per cent either way, so a fleet does not retry in step', () => {
    expect(backoffDelayMs(1, lowest)).toBe(BACKOFF_BASE_MS * 0.9);
    expect(backoffDelayMs(1, highest)).toBeCloseTo(BACKOFF_BASE_MS * 1.1, -2);
    for (let draw = 0; draw < 200; draw += 1) {
      const delay = backoffDelayMs(3);
      expect(delay).toBeGreaterThanOrEqual(4 * BACKOFF_BASE_MS * 0.9);
      expect(delay).toBeLessThanOrEqual(4 * BACKOFF_BASE_MS * 1.1);
    }
  });

  it('treats a zero or negative failure count as the first failure', () => {
    expect(backoffDelayMs(0, middle)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(-3, middle)).toBe(BACKOFF_BASE_MS);
  });

  it('waits as long as the provider asked when that is longer than the backoff', () => {
    const retryAt = retryAtAfterFailure(now, 1, 3 * 3600, middle);
    expect(retryAt.getTime() - now.getTime()).toBe(3 * HOUR);
  });

  it('keeps the backoff when the provider asked for less', () => {
    const retryAt = retryAtAfterFailure(now, 4, 60, middle);
    expect(retryAt.getTime() - now.getTime()).toBe(8 * BACKOFF_BASE_MS);
  });

  it('honours a Retry-After past the daily cap, up to a week', () => {
    const twoDays = retryAtAfterFailure(now, 1, 48 * 3600, middle);
    expect(twoDays.getTime() - now.getTime()).toBe(48 * HOUR);
    const absurd = retryAtAfterFailure(now, 1, 365 * 24 * 3600, middle);
    expect(absurd.getTime() - now.getTime()).toBe(RETRY_AFTER_CAP_MS);
  });

  it('keeps the success jitter within ten per cent of the interval', () => {
    expect(jitterFactor(lowest)).toBeCloseTo(0.9);
    expect(jitterFactor(middle)).toBe(1);
    expect(jitterFactor(highest)).toBeCloseTo(1.1);
  });
});

describe('bank-sync interval changes', () => {
  it('is due one new interval after the last good pull', () => {
    const lastSync = new Date(now.getTime() - 1 * HOUR);
    expect(nextPullForInterval(now, lastSync, 12).toISOString()).toBe('2026-11-10T23:00:00.000Z');
  });

  it('is due now when the new interval has already passed since the last pull', () => {
    const lastSync = new Date(now.getTime() - 5 * HOUR);
    expect(nextPullForInterval(now, lastSync, 2)).toEqual(now);
  });

  it('is due now for a connection never pulled', () => {
    expect(nextPullForInterval(now, null, 24)).toEqual(now);
  });
});

describe('manual pull cooldown', () => {
  it('names the seconds left of the cooldown', () => {
    const tried = new Date(now.getTime() - 20_000);
    expect(manualWaitSeconds(now, tried, null)).toBe(MANUAL_COOLDOWN_MS / 1000 - 20);
  });

  it('asks for a minute while another pull holds the connection', () => {
    const tried = new Date(now.getTime() - 10 * 60_000);
    const lease = new Date(now.getTime() + 20 * 60_000);
    expect(manualWaitSeconds(now, tried, lease)).toBe(60);
  });

  it('never says zero seconds', () => {
    expect(manualWaitSeconds(now, null, null)).toBe(1);
    expect(manualWaitSeconds(now, new Date(now.getTime() - 3600_000), null)).toBe(1);
  });
});

describe('Retry-After', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('120', now)).toBe(120);
    expect(parseRetryAfter(' 3600 ', now)).toBe(3600);
  });

  it('reads an HTTP date as the seconds until then', () => {
    expect(parseRetryAfter('Tue, 10 Nov 2026 14:00:00 GMT', now)).toBe(2 * 3600);
  });

  it('ignores a date in the past, zero, a negative or garbage', () => {
    expect(parseRetryAfter('Tue, 10 Nov 2026 11:00:00 GMT', now)).toBeUndefined();
    expect(parseRetryAfter('0', now)).toBeUndefined();
    expect(parseRetryAfter('-5', now)).toBeUndefined();
    expect(parseRetryAfter('soon', now)).toBeUndefined();
    expect(parseRetryAfter('', now)).toBeUndefined();
    expect(parseRetryAfter(undefined, now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
  });
});

describe('failed pulls', () => {
  it('stops at a refused credential: only the user can fix it', () => {
    expect(failureOf(new BankSyncAuthError())).toEqual({
      reason: 'credential_refused',
      needsUser: true,
    });
  });

  it('keeps the wait a rate limit asked for', () => {
    expect(failureOf(new BankSyncTemporaryError('HTTP 429', 900))).toEqual({
      reason: 'provider_busy',
      retryAfterSeconds: 900,
      needsUser: false,
    });
  });

  it('backs off on anything else, stored as a code the page translates, not the message', () => {
    expect(failureOf(new Error('ACME Bridge said no'))).toEqual({
      reason: 'pull_failed',
      needsUser: false,
    });
    expect(failureOf('plain text').reason).toBe('pull_failed');
  });
});

describe('claims by workspace', () => {
  it('keeps each workspace together, in the order the claim returned them', () => {
    const claims = [
      { id: 1, workspaceId: 'ws-a' },
      { id: 2, workspaceId: 'ws-b' },
      { id: 3, workspaceId: 'ws-a' },
    ];
    expect(byWorkspace(claims).map(group => group.map(claim => claim.id))).toEqual([[1, 3], [2]]);
  });
});

describe('the schedule a connection answers', () => {
  it('turns the columns into wire values', () => {
    expect(
      scheduleOf({
        syncIntervalHours: 3,
        nextPullAt: new Date('2026-11-10T13:00:00Z'),
        lastPullAttemptAt: null,
        consecutiveFailures: 2,
        backoffUntil: new Date('2026-11-10T14:00:00Z'),
        backoffReason: 'provider_busy',
      } as never),
    ).toEqual({
      intervalHours: 3,
      nextPullAt: '2026-11-10T13:00:00.000Z',
      lastAttemptAt: null,
      consecutiveFailures: 2,
      backoffUntil: '2026-11-10T14:00:00.000Z',
      backoffReason: 'provider_busy',
    });
  });

  it('answers a reason stored before the codes as a failed pull, never as free text', () => {
    const settings = (backoffReason: string | null) =>
      scheduleOf({ syncIntervalHours: 6, consecutiveFailures: 1, backoffReason } as never);
    expect(settings('SimpleFIN answered HTTP 503').backoffReason).toBe('pull_failed');
    expect(settings(null).backoffReason).toBeNull();
  });

  it('answers the default cadence before the settings row is written', () => {
    expect(scheduleOf(null)).toMatchObject({ intervalHours: 6, consecutiveFailures: 0 });
  });
});
