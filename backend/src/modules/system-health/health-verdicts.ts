import type {
  SystemHealthCheck,
  SystemHealthLevel,
  SystemHealthQueue,
  SystemHealthReason,
} from '../../contracts';

/** Workers write their heartbeat this often. */
export const HEARTBEAT_INTERVAL_MS = 30_000;
/** Four missed heartbeats: the worker is gone, not just busy. */
export const WORKER_STALE_MS = 4 * HEARTBEAT_INTERVAL_MS;
/** A big import can keep jobs waiting a few minutes; past this it is worth a look. */
export const LATENCY_WARNING_MS = 5 * 60_000;
/** Past this, with a live worker, jobs are not moving: something is stuck. */
export const LATENCY_ERROR_MS = 30 * 60_000;
/** Less than this free in the backup folder is a warning. */
export const LOW_SPACE_BYTES = 1024 ** 3;

type CheckKey = SystemHealthCheck['key'];

const check = (
  key: CheckKey,
  level: SystemHealthLevel,
  reason: SystemHealthReason,
  extra: Partial<Pick<SystemHealthCheck, 'since' | 'freeBytes' | 'url'>> = {},
): SystemHealthCheck => ({
  key,
  level,
  reason,
  since: extra.since ?? null,
  freeBytes: extra.freeBytes ?? null,
  url: extra.url ?? null,
});

/** The database or Redis: it answered or it did not. */
export function serviceVerdict(key: 'database' | 'redis', answered: boolean): SystemHealthCheck {
  return answered ? check(key, 'ok', 'ok') : check(key, 'error', 'unreachable');
}

export interface QueueFacts {
  name: string;
  /** False when Redis did not answer: nothing else is known then. */
  redisUp: boolean;
  workerSeenAt: Date | null;
  counts: { waiting: number; delayed: number; active: number; failed: number } | null;
  /** When the oldest waiting job became due; null when nothing waits. */
  oldestWaitingSince: Date | null;
}

/**
 * A queue is in trouble when its worker stopped writing its heartbeat, or when
 * jobs have waited too long to start. A slow queue is a warning; a queue that
 * has not moved for half an hour is an error, heartbeat or not.
 */
export function queueVerdict(facts: QueueFacts, now: Date): SystemHealthQueue {
  const base = {
    name: facts.name,
    workerSeenAt: facts.workerSeenAt?.toISOString() ?? null,
    waiting: facts.counts?.waiting ?? null,
    delayed: facts.counts?.delayed ?? null,
    active: facts.counts?.active ?? null,
    failed: facts.counts?.failed ?? null,
    oldestWaitingSeconds: null as number | null,
  };
  if (!facts.redisUp) {
    return { ...base, level: 'unknown', reason: 'redis_down' };
  }
  const waitedMs = facts.oldestWaitingSince
    ? Math.max(0, now.getTime() - facts.oldestWaitingSince.getTime())
    : null;
  const withWait = {
    ...base,
    oldestWaitingSeconds: waitedMs === null ? null : Math.round(waitedMs / 1000),
  };
  if (!facts.workerSeenAt) {
    return { ...withWait, level: 'error', reason: 'worker_missing' };
  }
  if (now.getTime() - facts.workerSeenAt.getTime() > WORKER_STALE_MS) {
    return { ...withWait, level: 'error', reason: 'worker_stale' };
  }
  if (waitedMs !== null && waitedMs >= LATENCY_ERROR_MS) {
    return { ...withWait, level: 'error', reason: 'stuck' };
  }
  if (waitedMs !== null && waitedMs >= LATENCY_WARNING_MS) {
    return { ...withWait, level: 'warning', reason: 'latency_high' };
  }
  return { ...withWait, level: 'ok', reason: 'ok' };
}

export interface SmtpFacts {
  /** SMTP_HOST and SMTP_FROM are set. */
  configured: boolean;
  redisUp: boolean;
  /** The last mail sent through the server's SMTP, if any. */
  lastSend: { ok: boolean; at: Date } | null;
}

/** The server's own SMTP (SMTP_* variables); a workspace's own mail server is its business. */
export function smtpVerdict(facts: SmtpFacts): SystemHealthCheck {
  if (!facts.configured) {
    return check('smtp', 'off', 'not_configured');
  }
  if (!facts.redisUp) {
    return check('smtp', 'unknown', 'redis_down');
  }
  if (!facts.lastSend) {
    return check('smtp', 'ok', 'no_mail_yet');
  }
  const since = facts.lastSend.at.toISOString();
  return facts.lastSend.ok
    ? check('smtp', 'ok', 'ok', { since })
    : check('smtp', 'error', 'last_send_failed', { since });
}

/** Web push needs both VAPID keys; one without the other is a broken setup. */
export function pushVerdict(publicKey: boolean, privateKey: boolean): SystemHealthCheck {
  if (publicKey && privateKey) {
    return check('push', 'ok', 'ok');
  }
  return publicKey || privateKey
    ? check('push', 'error', 'keys_incomplete')
    : check('push', 'off', 'not_configured');
}

export type BackupFolderFacts =
  | { configured: false }
  | { configured: true; writable: false }
  | { configured: true; writable: true; freeBytes: number | null };

/** The server folder for scheduled backups (BACKUP_LOCAL_ROOT), when there is one. */
export function backupsVerdict(facts: BackupFolderFacts): SystemHealthCheck {
  if (!facts.configured) {
    return check('backups', 'off', 'not_configured');
  }
  if (!facts.writable) {
    return check('backups', 'error', 'not_writable');
  }
  const freeBytes = facts.freeBytes;
  if (freeBytes !== null && freeBytes < LOW_SPACE_BYTES) {
    return check('backups', 'warning', 'low_space', { freeBytes });
  }
  return check('backups', 'ok', 'ok', { freeBytes });
}

/** `https://x.example.com/path` → `https://x.example.com`; null for anything that is not a URL. */
export function originOf(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * APP_URL (else FRONTEND_URL) is what links in mail and shared links point to.
 * It should be the address the admin opened the app at; when the browser did
 * not say, only its presence is checked.
 */
export function appUrlVerdict(configured: string | null, opened: string | null): SystemHealthCheck {
  const url = originOf(configured);
  if (!url) {
    return check('app_url', 'error', 'missing');
  }
  const openedOrigin = originOf(opened);
  if (openedOrigin && openedOrigin !== url) {
    return check('app_url', 'warning', 'mismatch', { url });
  }
  return check('app_url', 'ok', 'ok', { url });
}

/** Saved credentials are encrypted with INTEGRATIONS_ENCRYPTION_KEY, else with JWT_SECRET. */
export function encryptionKeyVerdict(key: boolean, jwtSecret: boolean): SystemHealthCheck {
  if (key) {
    return check('encryption_key', 'ok', 'ok');
  }
  return jwtSecret
    ? check('encryption_key', 'warning', 'fallback_jwt')
    : check('encryption_key', 'error', 'missing');
}

const RANK: Record<SystemHealthLevel, number> = { ok: 0, off: 0, unknown: 0, warning: 1, error: 2 };

/** The worst level that counts: an optional part left off or an unknowable figure is not a fault. */
export function overallLevel(levels: SystemHealthLevel[]): 'ok' | 'warning' | 'error' {
  const worst = Math.max(0, ...levels.map(level => RANK[level]));
  return worst === 2 ? 'error' : worst === 1 ? 'warning' : 'ok';
}
