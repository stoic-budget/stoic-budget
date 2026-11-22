import {
  fill,
  formatBytes,
  formatHealthTime,
  formatWait,
} from '@/app/components/system-health/health-format';
import type { SystemHealthCheck, SystemHealthQueue } from '@/app/lib/contracts';
import { resolveLocaleTag } from '@/app/lib/user-format';

/** The page's reason texts, as plain strings (`t.reasons.x.value`). */
export type ReasonTexts = Record<
  | 'answering'
  | 'unreachable'
  | 'set'
  | 'redisDown'
  | 'smtpOk'
  | 'smtpNoMail'
  | 'smtpFailed'
  | 'smtpOff'
  | 'pushOff'
  | 'pushIncomplete'
  | 'backupsOk'
  | 'backupsOff'
  | 'backupsNotWritable'
  | 'backupsLowSpace'
  | 'appUrlOk'
  | 'appUrlMissing'
  | 'appUrlMismatch'
  | 'keyFallback'
  | 'keyMissing'
  | 'queueOk'
  | 'workerStale'
  | 'workerMissing'
  | 'latencyHigh'
  | 'stuck'
  | 'queueFigures',
  string
>;

const VARIABLE: Partial<Record<SystemHealthCheck['key'], string>> = {
  database: 'DATABASE_URL',
  redis: 'REDIS_URL',
};

/** What a check found and what to do about it, in the reader's words. */
export function checkText(check: SystemHealthCheck, r: ReasonTexts, locale: string): string {
  const time = check.since ? formatHealthTime(check.since, locale) : '';
  const free = check.freeBytes === null ? '' : formatBytes(check.freeBytes, locale);
  const url = check.url ?? '';
  switch (check.reason) {
    case 'ok':
      switch (check.key) {
        case 'database':
        case 'redis':
          return r.answering;
        case 'smtp':
          return fill(r.smtpOk, { time });
        case 'backups':
          return check.freeBytes === null ? r.set : fill(r.backupsOk, { free });
        case 'app_url':
          return fill(r.appUrlOk, { url });
        default:
          return r.set;
      }
    case 'unreachable':
      return fill(r.unreachable, { variable: VARIABLE[check.key] ?? '' });
    case 'not_configured':
      return check.key === 'smtp' ? r.smtpOff : check.key === 'push' ? r.pushOff : r.backupsOff;
    case 'no_mail_yet':
      return r.smtpNoMail;
    case 'last_send_failed':
      return fill(r.smtpFailed, { time });
    case 'keys_incomplete':
      return r.pushIncomplete;
    case 'not_writable':
      return r.backupsNotWritable;
    case 'low_space':
      return fill(r.backupsLowSpace, { free });
    case 'missing':
      return check.key === 'app_url' ? r.appUrlMissing : r.keyMissing;
    case 'mismatch':
      return fill(r.appUrlMismatch, { url });
    case 'fallback_jwt':
      return r.keyFallback;
    case 'redis_down':
      return r.redisDown;
    default:
      return '';
  }
}

/** A queue's verdict; the figures line is separate (`queueFigures`). */
export function queueText(queue: SystemHealthQueue, r: ReasonTexts, locale: string): string {
  const time = queue.workerSeenAt ? formatHealthTime(queue.workerSeenAt, locale) : '';
  const wait =
    queue.oldestWaitingSeconds === null ? '' : formatWait(queue.oldestWaitingSeconds, locale);
  switch (queue.reason) {
    case 'ok':
      return fill(r.queueOk, { time });
    case 'worker_stale':
      return fill(r.workerStale, { time });
    case 'worker_missing':
      return r.workerMissing;
    case 'latency_high':
      return fill(r.latencyHigh, { wait });
    case 'stuck':
      return fill(r.stuck, { wait });
    case 'redis_down':
      return r.redisDown;
    default:
      return '';
  }
}

/** "Waiting 3 · scheduled 0 · …"; null while Redis is down and nothing is known. */
export function queueFigures(
  queue: SystemHealthQueue,
  r: ReasonTexts,
  locale: string,
): string | null {
  if (queue.waiting === null) {
    return null;
  }
  const number = new Intl.NumberFormat(resolveLocaleTag(locale));
  const show = (value: number | null) => number.format(value ?? 0);
  return fill(r.queueFigures, {
    waiting: show(queue.waiting),
    delayed: show(queue.delayed),
    active: show(queue.active),
    failed: show(queue.failed),
  });
}
