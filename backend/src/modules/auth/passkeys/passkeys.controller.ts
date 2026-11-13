import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  LoginResponse,
  MessageResult,
  Passkey,
  PasskeyCreationOptions,
  PasskeyList,
  PasskeyParams,
  PasskeyPasswordBody,
  PasskeyRegistrationBody,
  PasskeyRenameBody,
  PasskeyRequestOptions,
  PasskeySignInBody,
} from '../../../contracts';
import type { User } from '../../../entities/user.entity';
import { AuthService } from '../auth.service';
import {
  clearPasskeyFlowCookie,
  PASSKEY_FLOW_COOKIE,
  setAuthCookies,
  setCsrfCookie,
  setPasskeyFlowCookie,
} from '../auth-cookies';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import { PasskeyAuthService } from './passkey-auth.service';
import { PASSKEY_CHALLENGE_TTL_MS } from './passkey-challenge.store';
import { PasskeysService } from './passkeys.service';

@Controller('auth')
export class PasskeysController {
  constructor(
    private readonly passkeys: PasskeysService,
    private readonly passkeyAuth: PasskeyAuthService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('passkeys')
  @SchemaResponse(PasskeyList)
  async list(@CurrentUser() user: User): Promise<PasskeyList> {
    return this.passkeys.list(user.id);
  }

  /** Step one of adding a passkey: re-checks the password, then issues the challenge. */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('passkeys/registration-options')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(PasskeyCreationOptions)
  async registrationOptions(
    @CurrentUser() user: User,
    @SchemaBody(PasskeyPasswordBody) dto: PasskeyPasswordBody,
  ): Promise<PasskeyCreationOptions> {
    return this.passkeys.registrationOptions(user.id, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('passkeys')
  @HttpCode(HttpStatus.CREATED)
  @SchemaResponse(Passkey)
  async register(
    @CurrentUser() user: User,
    @SchemaBody(PasskeyRegistrationBody) dto: PasskeyRegistrationBody,
  ): Promise<Passkey> {
    return this.passkeys.register(user.id, dto.name, dto.credential);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('passkeys/:passkeyId')
  @SchemaResponse(Passkey)
  async rename(
    @CurrentUser() user: User,
    @SchemaParams(PasskeyParams) { passkeyId }: PasskeyParams,
    @SchemaBody(PasskeyRenameBody) dto: PasskeyRenameBody,
  ): Promise<Passkey> {
    return this.passkeys.rename(user.id, passkeyId, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Delete('passkeys/:passkeyId')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(MessageResult)
  async remove(
    @CurrentUser() user: User,
    @SchemaParams(PasskeyParams) { passkeyId }: PasskeyParams,
    @SchemaBody(PasskeyPasswordBody) dto: PasskeyPasswordBody,
  ): Promise<{ message: string }> {
    await this.passkeys.remove(user.id, passkeyId, dto.password);
    return { message: 'Passkey removed' };
  }

  /**
   * Starts a sign-in without an e-mail. The challenge is bound to a fresh
   * httpOnly cookie, so only this browser can answer it.
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('passkey-login/options')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(PasskeyRequestOptions)
  async signInOptions(@Res({ passthrough: true }) res: Response): Promise<PasskeyRequestOptions> {
    const flowSecret = randomBytes(32).toString('base64url');
    const options = await this.passkeyAuth.signInOptions(flowSecret);
    setPasskeyFlowCookie(res, flowSecret, PASSKEY_CHALLENGE_TTL_MS);
    return options;
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('passkey-login')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(LoginResponse)
  async signIn(
    @SchemaBody(PasskeySignInBody) dto: PasskeySignInBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthResponseDto['user'] }> {
    const flowSecret: string | undefined = req.cookies?.[PASSKEY_FLOW_COOKIE];
    // The challenge is spent whatever happens next, so the cookie goes too.
    clearPasskeyFlowCookie(res);
    const user = await this.passkeyAuth.signIn(flowSecret, dto.credential);
    const session = await this.authService.generateTokens(user, {
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
    });
    setAuthCookies(res, { accessToken: session.access_token, refreshToken: session.refresh_token });
    setCsrfCookie(res, randomBytes(32).toString('hex'));
    return { user: session.user };
  }
}
