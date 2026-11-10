import { Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { SchemaBody } from '../../../common/effect/schema-body';
import { SchemaResponse } from '../../../common/effect/schema-response';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SetPasswordBody, UserUpdateResponse } from '../../../contracts';
import { setAuthCookies, setCsrfCookie } from '../auth-cookies';
import { toCurrentUser } from '../current-user.view';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';
import { clearOidcCookie, OIDC_STEP_UP_COOKIE, readOidcCookie } from './oidc-cookies';
import { PasswordSetService } from './password-set.service';

@Controller('auth/password')
export class PasswordSetController {
  constructor(private readonly passwords: PasswordSetService) {}

  /**
   * Sets the first password of an account made by single sign-on. Needs the
   * step-up cookie of a fresh provider sign-in made from this very session
   * (`POST /auth/oidc/reauth`); a request with a valid body spends the cookie.
   * Throttled like a password change.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('set')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(UserUpdateResponse)
  async set(
    @CurrentUser() user: AuthenticatedUser,
    @SchemaBody(SetPasswordBody) body: SetPasswordBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const secret = readOidcCookie(req, OIDC_STEP_UP_COOKIE);
    clearOidcCookie(res, OIDC_STEP_UP_COOKIE);
    const result = await this.passwords.set(
      { userId: user.id, sessionId: user.currentSessionId ?? null },
      secret,
      body.newPassword,
      { userAgent: req.headers['user-agent'] || null, ipAddress: req.ip || null },
    );
    setAuthCookies(res, {
      accessToken: result.tokens.access_token,
      refreshToken: result.tokens.refresh_token,
    });
    setCsrfCookie(res, randomBytes(32).toString('hex'));
    return { user: toCurrentUser(result.user) };
  }
}
