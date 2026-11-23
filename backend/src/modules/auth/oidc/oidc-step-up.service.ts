import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import type { Repository } from 'typeorm';
import type { ErrorCode } from '../../../common/errors/app-error';
import { User, UserIdentity } from '../../../entities';
import { AuditService } from '../../audit/audit.service';
import { recordOidcEvent } from './oidc-audit';
import type { IdTokenClaims } from './oidc-id-token';
import { OidcRefusal } from './oidc-refusal';
import { OidcStateStore } from './oidc-state.store';

/** How long a fresh provider sign-in lets its session set a password. */
export const STEP_UP_TTL_SECONDS = 300;
/** The oldest provider sign-in (auth_time) that still counts as fresh. */
const MAX_AUTH_AGE_SECONDS = 300;
/** How far the provider's clock may run apart from ours, either way. */
const CLOCK_TOLERANCE_SECONDS = 60;

/**
 * The provider says when the person signed in (auth_time). A re-authentication
 * asks for a new sign-in (prompt=login, max_age=0); a provider that ignores
 * that answers an old time, or none, and proves nothing. So the sign-in must
 * come after the re-authentication started (give or take the clock
 * tolerance), not merely within five minutes of now.
 */
export function isFreshAuthentication(
  authTime: number | null,
  times: { now: number; startedAt: number },
): boolean {
  if (authTime === null) return false;
  if (authTime > times.now + CLOCK_TOLERANCE_SECONDS) return false;
  if (authTime < times.startedAt - CLOCK_TOLERANCE_SECONDS) return false;
  return times.now - authTime <= MAX_AUTH_AGE_SECONDS;
}

export interface StepUpRecord {
  userId: string;
  sessionId: string;
  identityId: string;
  issuer: string;
  /** Milliseconds; Redis drops the record then too. */
  expiresAt: number;
}

/**
 * A step-up: proof that the person behind one session has just signed in at
 * the provider with an identity linked to them. Granted by the
 * re-authentication callback, kept in Redis under a hash of a secret that
 * only the browser's HttpOnly cookie holds, and spent once.
 */
@Injectable()
export class OidcStepUpService {
  private readonly logger = new Logger(OidcStepUpService.name);

  constructor(
    private readonly store: OidcStateStore,
    private readonly auditService: AuditService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserIdentity) private readonly identities: Repository<UserIdentity>,
  ) {}

  /**
   * Who may start a re-authentication: an active account that has no password
   * yet, signed in with a session we can bind the step-up to.
   */
  async assertCanStart(user: User, sessionId: string | null): Promise<void> {
    if (user.passwordSet) await this.refuse(user, null, 'AUTH_PASSWORD_ALREADY_SET');
    if (!sessionId) await this.refuse(user, null, 'AUTH_SESSION_MISSING');
  }

  /**
   * Checks a re-authentication's ID token and answers the step-up secret.
   * The provider account must already be linked to the user who started it:
   * another person's account, even a valid one, proves nothing about them.
   */
  async grant(
    flow: { userId: string; sessionId: string; startedAt: number },
    claims: IdTokenClaims,
    issuer: string,
  ): Promise<string> {
    const user = await this.users.findOne({ where: { id: flow.userId } });
    if (!user?.isActive) {
      return this.refuse(user, issuer, 'AUTH_ACCOUNT_INACTIVE', HttpStatus.UNAUTHORIZED);
    }
    if (user.passwordSet) await this.refuse(user, issuer, 'AUTH_PASSWORD_ALREADY_SET');
    const identity = await this.identities.findOne({ where: { issuer, subject: claims.subject } });
    if (!identity || identity.userId !== user.id) {
      await this.refuse(user, issuer, 'OIDC_REAUTH_WRONG_ACCOUNT', HttpStatus.FORBIDDEN);
    }
    const times = { now: Math.floor(Date.now() / 1000), startedAt: flow.startedAt };
    if (!isFreshAuthentication(claims.authTime, times)) {
      await this.refuse(user, issuer, 'OIDC_REAUTH_NOT_FRESH', HttpStatus.FORBIDDEN);
    }
    const secret = randomBytes(32).toString('base64url');
    const record: StepUpRecord = {
      userId: user.id,
      sessionId: flow.sessionId,
      identityId: (identity as UserIdentity).id,
      issuer,
      expiresAt: Date.now() + STEP_UP_TTL_SECONDS * 1000,
    };
    await this.store.put('step-up', secret, record, STEP_UP_TTL_SECONDS);
    await recordOidcEvent(this.auditService, this.logger, 'reauthenticated', {
      user,
      issuer,
      identityId: record.identityId,
    });
    return secret;
  }

  /**
   * Spends a step-up. Taken first, so a replay finds nothing and a refused
   * attempt (another session or user) burns it too. Null unless it was
   * granted to this very user and session and has not expired.
   */
  async consume(
    secret: string | undefined,
    userId: string,
    sessionId: string | null,
  ): Promise<StepUpRecord | null> {
    const record = secret ? await this.store.take<StepUpRecord>('step-up', secret) : null;
    if (!(record && sessionId)) return null;
    if (record.userId !== userId || record.sessionId !== sessionId) return null;
    return record.expiresAt > Date.now() ? record : null;
  }

  private async refuse(
    user: User | null,
    issuer: string | null,
    reason: ErrorCode,
    status: HttpStatus = HttpStatus.CONFLICT,
  ): Promise<never> {
    await recordOidcEvent(this.auditService, this.logger, 'refused', { user, issuer, reason });
    throw new OidcRefusal(reason, status);
  }
}
