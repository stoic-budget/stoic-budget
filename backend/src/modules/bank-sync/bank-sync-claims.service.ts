import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { OpenProtocolSettings } from '../../entities';
import {
  failureOf,
  jitterFactor,
  MANUAL_COOLDOWN_MS,
  manualWaitSeconds,
  nextPullForInterval,
  PULL_LEASE_MS,
  retryAtAfterFailure,
} from './bank-sync-schedule';

/** A connection this instance holds the lease on, until it records how the pull went. */
export interface BankSyncClaim {
  settingsId: string;
  connectionId: string;
  workspaceId: string;
  userId: string | null;
  /** Failed pulls in a row before this one. */
  failures: number;
  /** The lease this claim took: what it records is dropped once another pull took the connection over. */
  leaseUntil: Date;
}

const RETURNING = `
  RETURNING s.id AS "settingsId", s.integration_id AS "connectionId",
    i.workspace_id AS "workspaceId", i.connected_by_user_id AS "userId",
    s.consecutive_failures AS "failures", s.pull_lease_until AS "leaseUntil"`;

/**
 * A lease to the millisecond, so the instant the claim hands back is the one
 * stored and the outcome can be recorded only while this claim still holds it.
 */
const LEASE = `date_trunc('milliseconds', now() + make_interval(secs => $3))`;

/**
 * The schedule columns of a bank-sync connection, written only by these atomic
 * UPDATEs. Claiming takes a lease in the same statement that checks the
 * connection is due, so two backend instances (or the cron and a double-click)
 * never pull one connection at the same time.
 */
@Injectable()
export class BankSyncClaimsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Leases up to `limit` connections that are due: connected, auto-sync on, in
   * an ordinary workspace (a past version pulls nothing new), with someone to
   * pull as, and no lease another pull holds. SKIP LOCKED lets a second
   * instance claim the next ones instead of waiting for these.
   */
  async claimDue(providers: string[], limit: number): Promise<BankSyncClaim[]> {
    const result = await this.dataSource.query(
      `UPDATE open_protocol_settings s
       SET pull_lease_until = ${LEASE}, last_pull_attempt_at = now()
       FROM (
         SELECT due.id
         FROM open_protocol_settings due
         JOIN integrations di ON di.id = due.integration_id
         JOIN workspaces w ON w.id = di.workspace_id
         WHERE di.provider = ANY($1::text[])
           AND di.status = 'connected'
           AND w.kind = 'standard'
           AND di.connected_by_user_id IS NOT NULL
           AND due.config -> 'autoSync' IS DISTINCT FROM 'false'::jsonb
           AND (due.next_pull_at IS NULL OR due.next_pull_at <= now())
           AND (due.pull_lease_until IS NULL OR due.pull_lease_until <= now())
         ORDER BY due.next_pull_at ASC NULLS FIRST, di.workspace_id
         LIMIT $2
         FOR UPDATE OF due SKIP LOCKED
       ) picked, integrations i
       WHERE s.id = picked.id AND i.id = s.integration_id
       ${RETURNING}`,
      [providers, limit, PULL_LEASE_MS / 1000],
    );
    return rowsOf(result);
  }

  /**
   * Leases one connection for a pull the user asked for. Due or not, in
   * backoff or not: asking is what resets the backoff. Refused while another
   * pull holds it, or when it was tried within the cooldown.
   */
  async claimOne(workspaceId: string, connectionId: string): Promise<BankSyncClaim> {
    const result = await this.dataSource.query(
      `UPDATE open_protocol_settings s
       SET pull_lease_until = ${LEASE}, last_pull_attempt_at = now(),
           consecutive_failures = 0, backoff_until = NULL, backoff_reason = NULL
       FROM integrations i
       WHERE i.id = s.integration_id AND i.id = $1 AND i.workspace_id = $2
         AND (s.pull_lease_until IS NULL OR s.pull_lease_until <= now())
         AND (s.last_pull_attempt_at IS NULL
              OR s.last_pull_attempt_at <= now() - make_interval(secs => $4))
       ${RETURNING}`,
      [connectionId, workspaceId, PULL_LEASE_MS / 1000, MANUAL_COOLDOWN_MS / 1000],
    );
    const [claim] = rowsOf(result);
    if (claim) return claim;

    const [held] = await this.dataSource.query(
      `SELECT s.last_pull_attempt_at AS "lastAttemptAt", s.pull_lease_until AS "leaseUntil"
       FROM open_protocol_settings s JOIN integrations i ON i.id = s.integration_id
       WHERE i.id = $1 AND i.workspace_id = $2`,
      [connectionId, workspaceId],
    );
    const seconds = manualWaitSeconds(
      new Date(),
      held?.lastAttemptAt ?? null,
      held?.leaseUntil ?? null,
    );
    throw new HttpException(
      { ...appError('BANK_SYNC_TOO_SOON', { seconds }), retryAfterSeconds: seconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * A good pull: the backoff is over and the next one is an interval (as set now) away.
   * Like a failure, it is recorded only while this claim still holds the lease: a
   * pull that outlived it must not release the one that took the connection over.
   */
  async recordSuccess(claim: BankSyncClaim): Promise<void> {
    await this.dataSource.query(
      `UPDATE open_protocol_settings
       SET next_pull_at = now() + make_interval(secs => sync_interval_hours * 3600 * $2::float8),
           pull_lease_until = NULL, consecutive_failures = 0,
           backoff_until = NULL, backoff_reason = NULL
       WHERE id = $1 AND pull_lease_until = $3`,
      [claim.settingsId, jitterFactor(), claim.leaseUntil],
    );
  }

  /**
   * A failed pull. A refused credential stops automatic pulls through the
   * connection's re-auth status, not a backoff: retrying cannot fix it, and
   * once the user links again it is due at once. Anything else backs off.
   */
  async recordFailure(claim: BankSyncClaim, error: unknown, now = new Date()): Promise<void> {
    const failure = failureOf(error);
    const failures = claim.failures + 1;
    const retryAt = failure.needsUser
      ? null
      : retryAtAfterFailure(now, failures, failure.retryAfterSeconds);
    await this.dataSource.query(
      `UPDATE open_protocol_settings
       SET next_pull_at = COALESCE($3::timestamptz, now()), backoff_until = $3::timestamptz,
           pull_lease_until = NULL, consecutive_failures = $2, backoff_reason = $4
       WHERE id = $1 AND pull_lease_until = $5`,
      [claim.settingsId, failures, retryAt, failure.reason, claim.leaseUntil],
    );
  }

  /** A new interval moves the due time with it, unless the connection is backing off. */
  async setInterval(settings: OpenProtocolSettings, hours: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE open_protocol_settings
       SET sync_interval_hours = $2,
           next_pull_at = CASE WHEN backoff_until > now() THEN next_pull_at ELSE $3 END
       WHERE id = $1`,
      [settings.id, hours, nextPullForInterval(new Date(), settings.lastSyncAt, hours)],
    );
  }
}

/** TypeORM answers an UPDATE … RETURNING as `[rows, count]`. */
function rowsOf(result: unknown): BankSyncClaim[] {
  const rows = (Array.isArray(result) && Array.isArray(result[0]) ? result[0] : []) as Array<
    BankSyncClaim & { failures: number | string; leaseUntil: Date | string }
  >;
  return rows.map(row => ({
    ...row,
    failures: Number(row.failures),
    leaseUntil: new Date(row.leaseUntil),
  }));
}
