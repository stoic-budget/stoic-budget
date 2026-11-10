import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { User, UserIdentity } from '../../../entities';
import { AuditService } from '../../audit/audit.service';
import { AuthService, type SessionContext } from '../auth.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import { TwoFactorService } from '../two-factor.service';
import { OidcAccountsService } from './oidc-accounts.service';
import { recordOidcEvent } from './oidc-audit';
import { verifyIdToken } from './oidc-id-token';
import { OidcProviderClient } from './oidc-provider.client';
import { OidcCallbackFailure, OidcRefusal, refusalCode } from './oidc-refusal';
import { OidcSettingsService, oidcRedirectUri } from './oidc-settings.service';
import { OidcStateStore } from './oidc-state.store';
import { OidcStepUpService } from './oidc-step-up.service';

/** A sign-in or a link in flight: 10 minutes, then the state is gone. */
const FLOW_TTL_SECONDS = 600;
/** Wrong second-factor codes a finished sign-in survives before it is dropped. */
const MAX_CODE_FAILURES = 5;

export type OidcMode = 'login' | 'link' | 'reauth';

interface FlowRecord {
  mode: OidcMode;
  bindingHash: string;
  verifier: string;
  nonce: string;
  issuer: string;
  clientId: string;
  redirectUri: string;
  next: string | null;
  userId: string | null;
  /** The session a re-authentication grants its step-up to. */
  sessionId?: string | null;
  /** Seconds; a re-authentication's sign-in must not be older than this. */
  startedAt?: number;
}

interface TicketRecord {
  userId: string;
  identityId: string;
  issuer: string;
}

const random = () => randomBytes(32).toString('base64url');
const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');
const sameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** A path on this site, or null: no scheme, no host, no `//` or `/\` tricks. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if ([...value].some(char => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f))
    return null;
  try {
    const base = 'https://app.invalid';
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

/**
 * The authorization code flow with PKCE (S256), state and nonce. State,
 * nonce and verifier live in Redis for 10 minutes and are taken once; the
 * state is also tied to the browser that started it (a hashed cookie), so a
 * callback link sent to someone else signs nobody in and links nothing.
 */
@Injectable()
export class OidcLoginService {
  private readonly logger = new Logger(OidcLoginService.name);

  constructor(
    private readonly settings: OidcSettingsService,
    private readonly provider: OidcProviderClient,
    private readonly store: OidcStateStore,
    private readonly accounts: OidcAccountsService,
    private readonly authService: AuthService,
    private readonly twoFactor: TwoFactorService,
    private readonly auditService: AuditService,
    private readonly stepUp: OidcStepUpService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserIdentity) private readonly identities: Repository<UserIdentity>,
  ) {}

  /** The provider's authorization URL, and the browser binding for the cookie. */
  async start(
    mode: OidcMode,
    options: { next?: string | null; userId?: string | null; sessionId?: string | null },
  ): Promise<{ url: string; binding: string }> {
    const config = await this.settings.active();
    const redirectUri = oidcRedirectUri();
    if (!(config && redirectUri)) throw new OidcRefusal('OIDC_DISABLED', HttpStatus.NOT_FOUND);
    const discovery = await this.provider.discover(config.issuer);

    const state = random();
    const binding = random();
    const record: FlowRecord = {
      mode,
      bindingHash: sha256(binding),
      verifier: random(),
      nonce: random(),
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUri,
      next: safeNextPath(options.next),
      userId: options.userId ?? null,
      sessionId: options.sessionId ?? null,
      startedAt: Math.floor(Date.now() / 1000),
    };
    await this.store.put('flow', state, record, FLOW_TTL_SECONDS);

    const scopes = new Set([
      'openid',
      'email',
      'profile',
      ...(config.extraScopes?.split(' ') ?? []),
    ]);
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', [...scopes].join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', record.nonce);
    url.searchParams.set('code_challenge', sha256(record.verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    if (mode === 'reauth') {
      // A new sign-in, not the provider's remembered one; the ID token's
      // auth_time must fall after startedAt when the browser comes back.
      url.searchParams.set('prompt', 'login');
      url.searchParams.set('max_age', '0');
    }
    return { url: url.toString(), binding };
  }

  /**
   * Checks the provider's answer and acts on it. Login answers a ticket for
   * `complete`; link answers nothing. A failure after the state was found
   * is an OidcCallbackFailure naming the mode, so the browser goes back to
   * the page it came from.
   */
  async callback(
    query: Record<string, unknown>,
    binding: string | undefined,
  ): Promise<{
    mode: OidcMode;
    ticket: string | null;
    next: string | null;
    stepUp: string | null;
  }> {
    const state = typeof query.state === 'string' ? query.state : null;
    const flow = state && binding ? await this.store.take<FlowRecord>('flow', state) : null;
    if (!(flow && binding && sameHash(flow.bindingHash, sha256(binding)))) {
      await recordOidcEvent(this.auditService, this.logger, 'refused', {
        user: null,
        reason: 'OIDC_STATE_INVALID',
      });
      throw new OidcRefusal('OIDC_STATE_INVALID');
    }
    try {
      return { mode: flow.mode, ...(await this.finish(flow, query)) };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Single sign-on callback failed: ${error instanceof Error ? error.name : 'unknown'}`,
        );
      }
      throw new OidcCallbackFailure(flow.mode, refusalCode(error));
    }
  }

  private async finish(flow: FlowRecord, query: Record<string, unknown>) {
    const user = flow.userId ? await this.users.findOne({ where: { id: flow.userId } }) : null;
    if (typeof query.error === 'string') {
      await recordOidcEvent(this.auditService, this.logger, 'refused', {
        user,
        issuer: flow.issuer,
        reason: 'OIDC_PROVIDER_DENIED',
      });
      throw new OidcRefusal('OIDC_PROVIDER_DENIED');
    }
    const config = await this.settings.active();
    // RFC 9207: an `iss` in the answer must be ours, or another provider answered.
    const iss = query.iss;
    const code = typeof query.code === 'string' ? query.code : null;
    if (!config || config.issuer !== flow.issuer || config.clientId !== flow.clientId) {
      throw new OidcRefusal('OIDC_DISABLED');
    }
    if ((iss !== undefined && iss !== flow.issuer) || !code)
      throw new OidcRefusal('OIDC_STATE_INVALID');

    const discovery = await this.provider.discover(config.issuer);
    const idToken = await this.provider.exchangeCode(discovery, config, {
      code,
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
    });
    const claims = await verifyIdToken(idToken, {
      issuer: config.issuer,
      clientId: config.clientId,
      nonce: flow.nonce,
      keys: fresh => this.provider.keys(discovery.jwks_uri, fresh),
    }).catch(async error => {
      await recordOidcEvent(this.auditService, this.logger, 'refused', {
        user,
        issuer: flow.issuer,
        reason: 'OIDC_TOKEN_INVALID',
      });
      throw error;
    });

    if (flow.mode === 'link') {
      await this.accounts.link(flow.userId as string, claims, config.issuer);
      return { ticket: null, next: null, stepUp: null };
    }
    if (flow.mode === 'reauth') {
      if (!(flow.userId && flow.sessionId && typeof flow.startedAt === 'number')) {
        throw new OidcRefusal('OIDC_STATE_INVALID');
      }
      const owner = { userId: flow.userId, sessionId: flow.sessionId, startedAt: flow.startedAt };
      const stepUp = await this.stepUp.grant(owner, claims, config.issuer);
      return { ticket: null, next: null, stepUp };
    }
    const signedIn = await this.accounts.signIn(claims, config);
    const ticket = random();
    const record: TicketRecord = {
      userId: signedIn.user.id,
      identityId: signedIn.identityId,
      issuer: config.issuer,
    };
    await this.store.put('ticket', ticket, record, FLOW_TTL_SECONDS);
    return { ticket, next: flow.next, stepUp: null };
  }

  /**
   * Turns a checked sign-in into a session. The account's own second factor
   * still applies: without a code the answer asks for one and the ticket
   * stays; the ticket is spent only by the request that issues the session.
   */
  async complete(
    ticket: string | undefined,
    twoFactorCode: string | null | undefined,
    context: SessionContext,
  ): Promise<AuthResponseDto | { twoFactorRequired: true }> {
    const record = ticket ? await this.store.peek<TicketRecord>('ticket', ticket) : null;
    if (!(ticket && record)) throw new UnauthorizedException(appError('OIDC_SIGN_IN_EXPIRED'));
    const user = await this.users.findOne({ where: { id: record.userId } });
    if (!user?.isActive) {
      await this.store.take('ticket', ticket);
      await recordOidcEvent(this.auditService, this.logger, 'refused', {
        user,
        issuer: record.issuer,
        reason: 'AUTH_ACCOUNT_INACTIVE',
      });
      throw new UnauthorizedException(appError('AUTH_ACCOUNT_INACTIVE'));
    }
    if (user.twoFactorEnabledAt) {
      if (!twoFactorCode?.trim()) return { twoFactorRequired: true };
      try {
        await this.twoFactor.assertLoginCode(user.id, twoFactorCode.trim());
      } catch (error) {
        const failures = await this.store.countFailure('ticket', ticket, FLOW_TTL_SECONDS);
        if (failures >= MAX_CODE_FAILURES) await this.store.take('ticket', ticket);
        throw error;
      }
    }
    // Of two requests with the same ticket, only one gets a session.
    if (!(await this.store.take('ticket', ticket))) {
      throw new UnauthorizedException(appError('OIDC_SIGN_IN_EXPIRED'));
    }
    const now = new Date();
    await this.users.update(user.id, { lastLogin: now });
    await this.identities.update({ id: record.identityId, userId: user.id }, { lastUsedAt: now });
    await recordOidcEvent(this.auditService, this.logger, 'sign_in', {
      user,
      issuer: record.issuer,
      identityId: record.identityId,
    });
    return this.authService.generateTokens(user, context);
  }
}
