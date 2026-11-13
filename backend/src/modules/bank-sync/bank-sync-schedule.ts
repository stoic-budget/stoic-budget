import type { OpenProtocolSettings } from '../../entities';
import { SYNC_INTERVAL_HOURS } from './bank-sync.config';
import { BankSyncAuthError, BankSyncTemporaryError } from './bank-sync-provider.interface';

/**
 * When a connection is pulled next. Pure functions only: the claims service
 * stores what they decide, the tests pin the arithmetic.
 *
 * Every due time carries jitter, so connections set up together (or spread
 * once by the migration) do not drift back into one burst against a provider.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The retry after a first failed pull; every further failure in a row doubles it. */
export const BACKOFF_BASE_MS = 30 * MINUTE_MS;
/** However many pulls failed in a row, the connection is tried again within a day. */
export const BACKOFF_CAP_MS = 24 * HOUR_MS;
/** A provider's Retry-After is honoured up to a week; longer is a broken header. */
export const RETRY_AFTER_CAP_MS = 7 * 24 * HOUR_MS;
/** How long a claimed pull holds its connection before another instance may take it over. */
export const PULL_LEASE_MS = 30 * MINUTE_MS;
/** A manual pull of a connection pulled (or tried) less than this ago is refused. */
export const MANUAL_COOLDOWN_MS = 60_000;
/** Each due time moves by up to this share of its delay, either way. */
const JITTER_SHARE = 0.1;

export type Random = () => number;

const jittered = (delayMs: number, random: Random): number =>
  delayMs * (1 - JITTER_SHARE + 2 * JITTER_SHARE * random());

/** The jitter factor alone, for the success path that multiplies the interval in SQL. */
export const jitterFactor = (random: Random = Math.random): number => jittered(1, random);

/** Delay before the next try after `failures` failed pulls in a row (1 = the first failure). */
export function backoffDelayMs(failures: number, random: Random = Math.random): number {
  const raw = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1));
  return Math.min(BACKOFF_CAP_MS, jittered(raw, random));
}

/**
 * When to try again after a failed pull: the backoff, or later if the provider
 * said so. Never sooner than a provider's Retry-After — it counts the calls.
 */
export function retryAtAfterFailure(
  now: Date,
  failures: number,
  retryAfterSeconds: number | undefined,
  random: Random = Math.random,
): Date {
  const asked = retryAfterSeconds ? Math.min(RETRY_AFTER_CAP_MS, retryAfterSeconds * 1000) : 0;
  return new Date(now.getTime() + Math.max(backoffDelayMs(failures, random), asked));
}

/**
 * The due time after the user picked another interval: one interval after the
 * last good pull, or now if that moment has passed (or nothing was pulled yet).
 */
export function nextPullForInterval(now: Date, lastSyncAt: Date | null, hours: number): Date {
  if (!lastSyncAt) return now;
  return new Date(Math.max(now.getTime(), lastSyncAt.getTime() + hours * HOUR_MS));
}

/** Seconds a refused manual pull has to wait: the cooldown left, or a minute while a pull runs. */
export function manualWaitSeconds(
  now: Date,
  lastAttemptAt: Date | null,
  leaseUntil: Date | null,
): number {
  if (leaseUntil && leaseUntil > now) return MANUAL_COOLDOWN_MS / 1000;
  const left = lastAttemptAt ? lastAttemptAt.getTime() + MANUAL_COOLDOWN_MS - now.getTime() : 0;
  return Math.max(1, Math.ceil(left / 1000));
}

/**
 * A Retry-After header in seconds: either form HTTP allows (delta-seconds or an
 * HTTP date). Anything unreadable, zero or in the past is no request at all.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now: Date = new Date(),
): number | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return seconds > 0 ? seconds : undefined;
  }
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return undefined;
  const seconds = Math.ceil((at - now.getTime()) / 1000);
  return seconds > 0 ? seconds : undefined;
}

/**
 * Why automatic pulls are held back, as a code the page translates. The
 * provider's own words stay in the connection's last error.
 */
export const BACKOFF_REASONS = ['provider_busy', 'credential_refused', 'pull_failed'] as const;
export type BackoffReason = (typeof BACKOFF_REASONS)[number];

export interface PullFailure {
  reason: BackoffReason;
  retryAfterSeconds?: number;
  /** The credential or consent was refused: only the user can fix it, retrying cannot. */
  needsUser: boolean;
}

export function failureOf(error: unknown): PullFailure {
  if (error instanceof BankSyncAuthError) return { reason: 'credential_refused', needsUser: true };
  if (error instanceof BankSyncTemporaryError) {
    return {
      reason: 'provider_busy',
      retryAfterSeconds: error.retryAfterSeconds,
      needsUser: false,
    };
  }
  return { reason: 'pull_failed', needsUser: false };
}

/** A stored reason as the answer names it; anything else stored is a failed pull. */
function reasonOf(value: string | null | undefined): BackoffReason | null {
  if (!value) return null;
  return (BACKOFF_REASONS as readonly string[]).includes(value)
    ? (value as BackoffReason)
    : 'pull_failed';
}

/** The schedule as the connection's answer carries it. */
export function scheduleOf(settings: OpenProtocolSettings | null) {
  const iso = (value: Date | null | undefined) => (value ? new Date(value).toISOString() : null);
  return {
    intervalHours: settings?.syncIntervalHours ?? SYNC_INTERVAL_HOURS.default,
    nextPullAt: iso(settings?.nextPullAt),
    lastAttemptAt: iso(settings?.lastPullAttemptAt),
    consecutiveFailures: settings?.consecutiveFailures ?? 0,
    backoffUntil: iso(settings?.backoffUntil),
    backoffReason: reasonOf(settings?.backoffReason),
  };
}

/** Claimed connections grouped by workspace, each workspace's pulls together and in claim order. */
export function byWorkspace<T extends { workspaceId: string }>(claims: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const claim of claims) {
    const group = groups.get(claim.workspaceId) ?? [];
    group.push(claim);
    groups.set(claim.workspaceId, group);
  }
  return [...groups.values()];
}
