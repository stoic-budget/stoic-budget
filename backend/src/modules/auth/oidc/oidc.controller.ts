import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { SkipCsrf } from '../../../common/decorators/skip-csrf.decorator';
import { SchemaBody } from '../../../common/effect/schema-body';
import { SchemaParams } from '../../../common/effect/schema-query';
import { SchemaResponse } from '../../../common/effect/schema-response';
import type { ErrorCode } from '../../../common/errors/app-error';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  LoginResponse,
  OidcAuthorization,
  OidcCompleteBody,
  OidcIdentityList,
  OidcIdentityParams,
  OidcLinkBody,
  OidcPublicStatus,
  OidcStartBody,
} from '../../../contracts';
import type { User } from '../../../entities';
import { setAuthCookies, setCsrfCookie } from '../auth-cookies';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';
import {
  clearOidcCookie,
  OIDC_FLOW_COOKIE,
  OIDC_STEP_UP_COOKIE,
  OIDC_TICKET_COOKIE,
  readOidcCookie,
  setOidcCookie,
} from './oidc-cookies';
import { OidcIdentitiesService } from './oidc-identities.service';
import { OidcLoginService } from './oidc-login.service';
import { OidcCallbackFailure, refusalCode } from './oidc-refusal';
import { appOrigin, OidcSettingsService } from './oidc-settings.service';
import { OidcStepUpService, STEP_UP_TTL_SECONDS } from './oidc-step-up.service';

const SETTINGS_PAGE = '/settings/profile?tab=security&section=single-sign-on';
const PASSWORD_PAGE = '/settings/profile?tab=security&section=password';

/** A page of this app: only our own origin and our own path, never one from the request. */
const page = (path: string, params: Record<string, string>): string => {
  const query = new URLSearchParams(params).toString();
  const joined = query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
  return `${appOrigin() ?? ''}${joined}`;
};

@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly login: OidcLoginService,
    private readonly settings: OidcSettingsService,
    private readonly identities: OidcIdentitiesService,
    private readonly stepUp: OidcStepUpService,
  ) {}

  /** Public: the login page shows the button only when this says so. */
  @Public()
  @Get('status')
  @SchemaResponse(OidcPublicStatus)
  status() {
    return this.settings.publicStatus();
  }

  /**
   * Where the browser goes to sign in at the provider. A POST, not a link:
   * it stores the state and sets the browser binding, which a GET must not.
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('start')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(OidcAuthorization)
  async start(
    @SchemaBody(OidcStartBody) body: OidcStartBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { url, binding } = await this.login.start('login', { next: body.next });
    setOidcCookie(res, OIDC_FLOW_COOKIE, binding);
    return { url };
  }

  /**
   * Where the provider sends the browser back. Reads the query by hand: the
   * provider adds parameters of its own (session_state, iss, scope), and any
   * failure must end on a page of ours, not on a JSON error.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const binding = readOidcCookie(req, OIDC_FLOW_COOKIE);
    clearOidcCookie(res, OIDC_FLOW_COOKIE);
    try {
      const result = await this.login.callback(req.query, binding);
      if (result.mode === 'reauth') {
        const maxAge = STEP_UP_TTL_SECONDS * 1000;
        setOidcCookie(res, OIDC_STEP_UP_COOKIE, result.stepUp as string, maxAge);
        res.redirect(HttpStatus.FOUND, page(PASSWORD_PAGE, { reauth: 'ok' }));
        return;
      }
      if (result.mode === 'link') {
        res.redirect(HttpStatus.FOUND, page(SETTINGS_PAGE, { oidc: 'linked' }));
        return;
      }
      setOidcCookie(res, OIDC_TICKET_COOKIE, result.ticket as string);
      const params: Record<string, string> = { oidc: 'complete' };
      if (result.next) params.next = result.next;
      res.redirect(HttpStatus.FOUND, page('/login', params));
    } catch (error) {
      const failure: { mode: string; code: ErrorCode } =
        error instanceof OidcCallbackFailure ? error : { mode: 'login', code: refusalCode(error) };
      if (failure.mode === 'reauth') {
        res.redirect(HttpStatus.FOUND, page(PASSWORD_PAGE, { reauthError: failure.code }));
        return;
      }
      const target = failure.mode === 'link' ? SETTINGS_PAGE : '/login';
      res.redirect(HttpStatus.FOUND, page(target, { oidcError: failure.code }));
    }
  }

  /** Issues the session for a checked sign-in, asking for the second factor first when on. */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(LoginResponse)
  async complete(
    @SchemaBody(OidcCompleteBody) body: OidcCompleteBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.login.complete(
      readOidcCookie(req, OIDC_TICKET_COOKIE),
      body.twoFactorCode,
      { userAgent: req.headers['user-agent'] || null, ipAddress: req.ip || null },
    );
    if ('twoFactorRequired' in result) return result;
    clearOidcCookie(res, OIDC_TICKET_COOKIE);
    setAuthCookies(res, { accessToken: result.access_token, refreshToken: result.refresh_token });
    setCsrfCookie(res, randomBytes(32).toString('hex'));
    return { user: result.user };
  }

  /**
   * Starts linking a provider account to the signed-in user, after the
   * current password: a session alone (borrowed, stolen) must not add a
   * way in that would outlive a password reset.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('link')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(OidcAuthorization)
  async link(
    @CurrentUser() user: User,
    @SchemaBody(OidcLinkBody) body: OidcLinkBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.identities.confirmPassword(user.id, body.password);
    const { url, binding } = await this.login.start('link', { userId: user.id });
    setOidcCookie(res, OIDC_FLOW_COOKIE, binding);
    return { url };
  }

  /**
   * Starts a fresh sign-in at the provider for an account made by single
   * sign-on, which has no password to confirm: the step-up it ends with lets
   * this session, and only this one, set a first password.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reauth')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(OidcAuthorization)
  async reauth(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    const sessionId = user.currentSessionId ?? null;
    await this.stepUp.assertCanStart(user, sessionId);
    const { url, binding } = await this.login.start('reauth', { userId: user.id, sessionId });
    setOidcCookie(res, OIDC_FLOW_COOKIE, binding);
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Get('identities')
  @SchemaResponse(OidcIdentityList)
  list(@CurrentUser() user: User) {
    return this.identities.list(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('identities/:identityId')
  @SchemaResponse(OidcIdentityList)
  unlink(
    @CurrentUser() user: User,
    @SchemaParams(OidcIdentityParams) { identityId }: OidcIdentityParams,
  ) {
    return this.identities.unlink(user.id, identityId);
  }
}
