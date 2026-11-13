import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/**
 * How one check came out. `off`: an optional part nobody set up; `unknown`:
 * it could not be checked (its answer lives in Redis and Redis is down).
 */
export const SystemHealthLevel = Schema.Literals(['ok', 'warning', 'error', 'off', 'unknown']);
export type SystemHealthLevel = Wire<typeof SystemHealthLevel>;

/** Why a check came out the way it did; the page words each one with what to do. */
export const SystemHealthReason = Schema.Literals([
  'ok',
  'unreachable',
  'not_configured',
  'no_mail_yet',
  'last_send_failed',
  'keys_incomplete',
  'not_writable',
  'low_space',
  'missing',
  'mismatch',
  'fallback_jwt',
  'redis_down',
  'worker_stale',
  'worker_missing',
  'latency_high',
  'stuck',
]);
export type SystemHealthReason = Wire<typeof SystemHealthReason>;

/**
 * A service the server needs or a part of its setup. Never a secret: a key or a
 * password is only reported as set or not.
 */
export const SystemHealthCheck = Schema.Struct({
  key: Schema.Literals([
    'database',
    'redis',
    'smtp',
    'push',
    'backups',
    'app_url',
    'encryption_key',
  ]),
  level: SystemHealthLevel,
  reason: SystemHealthReason,
  /** When the reason began: the last mail sent or the failed one. */
  since: Schema.NullOr(Schema.String),
  /** Free bytes in the backup folder. */
  freeBytes: Schema.NullOr(Schema.Number),
  /** The configured public address (APP_URL, else FRONTEND_URL), as an origin. */
  url: Schema.NullOr(Schema.String),
});
export type SystemHealthCheck = Wire<typeof SystemHealthCheck>;

/** One BullMQ queue: is a worker taking its jobs, and how long do they wait. Counts are null while Redis is down. */
export const SystemHealthQueue = Schema.Struct({
  name: Schema.String,
  level: SystemHealthLevel,
  reason: SystemHealthReason,
  /** The worker's last heartbeat; null when none was ever recorded. */
  workerSeenAt: Schema.NullOr(Schema.String),
  waiting: Schema.NullOr(Schema.Number),
  delayed: Schema.NullOr(Schema.Number),
  active: Schema.NullOr(Schema.Number),
  failed: Schema.NullOr(Schema.Number),
  /** How long the oldest waiting job has waited; null when nothing waits. */
  oldestWaitingSeconds: Schema.NullOr(Schema.Number),
});
export type SystemHealthQueue = Wire<typeof SystemHealthQueue>;

/** `GET /system/health` (instance admins only): every check, with what it found. */
export const AdminSystemHealth = Schema.Struct({
  /** The worst level among the checks; `off` and `unknown` do not count. */
  level: Schema.Literals(['ok', 'warning', 'error']),
  checkedAt: Schema.String,
  services: Schema.Array(SystemHealthCheck),
  queues: Schema.Array(SystemHealthQueue),
  config: Schema.Array(SystemHealthCheck),
});
export type AdminSystemHealth = Wire<typeof AdminSystemHealth>;

/** `GET /system/health?origin=`: the address the browser opened, to compare with APP_URL. */
export const SystemHealthQuery = Schema.Struct({
  origin: Schema.optional(Schema.String.check(Schema.isMaxLength(500))),
});
export type SystemHealthQuery = Wire<typeof SystemHealthQuery>;
