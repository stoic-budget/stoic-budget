import {
  appUrlVerdict,
  backupsVerdict,
  encryptionKeyVerdict,
  LATENCY_ERROR_MS,
  LATENCY_WARNING_MS,
  LOW_SPACE_BYTES,
  overallLevel,
  pushVerdict,
  type QueueFacts,
  queueVerdict,
  serviceVerdict,
  smtpVerdict,
  WORKER_STALE_MS,
} from '@/modules/system-health/health-verdicts';

const now = new Date('2026-11-10T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const counts = { waiting: 0, delayed: 0, active: 0, failed: 0 };
const queue = (over: Partial<QueueFacts>): QueueFacts => ({
  name: 'statement-parsing',
  redisUp: true,
  workerSeenAt: ago(5_000),
  counts,
  oldestWaitingSince: null,
  ...over,
});

describe('service verdicts', () => {
  it('reports Redis down as an error, not as healthy', () => {
    expect(serviceVerdict('redis', false)).toMatchObject({ level: 'error', reason: 'unreachable' });
    expect(serviceVerdict('redis', true)).toMatchObject({ level: 'ok', reason: 'ok' });
  });
});

describe('queueVerdict', () => {
  it('is fine with a fresh heartbeat and nothing waiting', () => {
    expect(queueVerdict(queue({}), now)).toMatchObject({ level: 'ok', reason: 'ok' });
  });

  it('flags a worker whose heartbeat went stale, and says since when', () => {
    const seen = ago(WORKER_STALE_MS + 1);
    const verdict = queueVerdict(queue({ workerSeenAt: seen }), now);
    expect(verdict).toMatchObject({ level: 'error', reason: 'worker_stale' });
    expect(verdict.workerSeenAt).toBe(seen.toISOString());
  });

  it('keeps a heartbeat right at the limit fresh', () => {
    expect(queueVerdict(queue({ workerSeenAt: ago(WORKER_STALE_MS) }), now).reason).toBe('ok');
  });

  it('flags a queue no worker ever reported for', () => {
    expect(queueVerdict(queue({ workerSeenAt: null }), now)).toMatchObject({
      level: 'error',
      reason: 'worker_missing',
      workerSeenAt: null,
    });
  });

  it('warns when jobs wait long, and calls a queue that has not moved for half an hour stuck', () => {
    const slow = queueVerdict(queue({ oldestWaitingSince: ago(LATENCY_WARNING_MS) }), now);
    expect(slow).toMatchObject({ level: 'warning', reason: 'latency_high' });
    expect(slow.oldestWaitingSeconds).toBe(LATENCY_WARNING_MS / 1000);
    const stuck = queueVerdict(queue({ oldestWaitingSince: ago(LATENCY_ERROR_MS) }), now);
    expect(stuck).toMatchObject({ level: 'error', reason: 'stuck' });
  });

  it('does not warn about a job that waited just under the threshold', () => {
    const verdict = queueVerdict(queue({ oldestWaitingSince: ago(LATENCY_WARNING_MS - 1000) }), now);
    expect(verdict.level).toBe('ok');
  });

  it('names a stale worker before a long wait: the wait is its consequence', () => {
    const verdict = queueVerdict(
      queue({ workerSeenAt: ago(WORKER_STALE_MS * 2), oldestWaitingSince: ago(LATENCY_ERROR_MS) }),
      now,
    );
    expect(verdict.reason).toBe('worker_stale');
  });

  it('knows nothing about a queue while Redis is down', () => {
    expect(queueVerdict(queue({ redisUp: false, counts: null }), now)).toMatchObject({
      level: 'unknown',
      reason: 'redis_down',
      waiting: null,
    });
  });
});

describe('smtpVerdict', () => {
  it('is off when SMTP is missing', () => {
    expect(smtpVerdict({ configured: false, redisUp: true, lastSend: null })).toMatchObject({
      level: 'off',
      reason: 'not_configured',
    });
  });

  it('reports the last failed send with its time', () => {
    const at = ago(60_000);
    expect(smtpVerdict({ configured: true, redisUp: true, lastSend: { ok: false, at } })).toMatchObject({
      level: 'error',
      reason: 'last_send_failed',
      since: at.toISOString(),
    });
  });

  it('is fine after a successful send or before the first one', () => {
    const at = ago(60_000);
    expect(smtpVerdict({ configured: true, redisUp: true, lastSend: { ok: true, at } })).toMatchObject({
      level: 'ok',
      reason: 'ok',
    });
    expect(smtpVerdict({ configured: true, redisUp: true, lastSend: null }).reason).toBe('no_mail_yet');
  });

  it('cannot read the last send while Redis is down', () => {
    expect(smtpVerdict({ configured: true, redisUp: false, lastSend: null }).level).toBe('unknown');
  });
});

describe('config verdicts', () => {
  it('push needs both VAPID keys', () => {
    expect(pushVerdict(true, true).level).toBe('ok');
    expect(pushVerdict(true, false)).toMatchObject({ level: 'error', reason: 'keys_incomplete' });
    expect(pushVerdict(false, false)).toMatchObject({ level: 'off', reason: 'not_configured' });
  });

  it('backup folder: off, unwritable, low on space, fine', () => {
    expect(backupsVerdict({ configured: false }).level).toBe('off');
    expect(backupsVerdict({ configured: true, writable: false })).toMatchObject({
      level: 'error',
      reason: 'not_writable',
    });
    expect(
      backupsVerdict({ configured: true, writable: true, freeBytes: LOW_SPACE_BYTES - 1 }),
    ).toMatchObject({ level: 'warning', reason: 'low_space', freeBytes: LOW_SPACE_BYTES - 1 });
    expect(backupsVerdict({ configured: true, writable: true, freeBytes: LOW_SPACE_BYTES }).level).toBe(
      'ok',
    );
  });

  it('APP_URL: missing, different from the opened address, or matching', () => {
    expect(appUrlVerdict(null, null)).toMatchObject({ level: 'error', reason: 'missing' });
    expect(appUrlVerdict('not a url', null).reason).toBe('missing');
    expect(appUrlVerdict('https://budget.example.co.il/', 'http://10.0.0.5:3000')).toMatchObject({
      level: 'warning',
      reason: 'mismatch',
      url: 'https://budget.example.co.il',
    });
    expect(appUrlVerdict('https://budget.example.co.il/app', 'https://budget.example.co.il')).toMatchObject({
      level: 'ok',
      url: 'https://budget.example.co.il',
    });
    // The browser did not say where it is: only presence counts.
    expect(appUrlVerdict('https://budget.example.co.il', null).level).toBe('ok');
  });

  it('encryption key: set, falling back to JWT_SECRET, or missing', () => {
    expect(encryptionKeyVerdict(true, true).level).toBe('ok');
    expect(encryptionKeyVerdict(false, true)).toMatchObject({ level: 'warning', reason: 'fallback_jwt' });
    expect(encryptionKeyVerdict(false, false)).toMatchObject({ level: 'error', reason: 'missing' });
  });
});

describe('overallLevel', () => {
  it('takes the worst level; off and unknown are not faults', () => {
    expect(overallLevel(['ok', 'off', 'unknown'])).toBe('ok');
    expect(overallLevel(['ok', 'warning', 'off'])).toBe('warning');
    expect(overallLevel(['warning', 'error'])).toBe('error');
  });
});
