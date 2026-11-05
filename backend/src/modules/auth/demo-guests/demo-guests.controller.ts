import { Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { SkipCsrf } from '../../../common/decorators/skip-csrf.decorator';
import { SchemaResponse } from '../../../common/effect/schema-response';
import { RegisterResponse } from '../../../contracts';
import { setAuthCookies, setCsrfCookie } from '../auth-cookies';
import { Public } from '../decorators/public.decorator';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import { DemoGuestsService } from './demo-guests.service';

@Controller('auth')
export class DemoGuestsController {
  constructor(private readonly demoGuestsService: DemoGuestsService) {}

  /**
   * `POST /auth/demo`: a guest account with a filled demo workspace, signed
   * in through the same httpOnly cookies as a login. 404 unless the instance
   * runs with DEMO_GUESTS_ENABLED, 503 when it already holds DEMO_GUESTS_MAX guests.
   */
  @Public()
  @SkipCsrf()
  // Each call creates an account and a year of sample rows.
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('demo')
  @HttpCode(HttpStatus.CREATED)
  @SchemaResponse(RegisterResponse)
  async createGuest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthResponseDto['user'] }> {
    const result = await this.demoGuestsService.create({
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
    });
    setAuthCookies(res, { accessToken: result.access_token, refreshToken: result.refresh_token });
    setCsrfCookie(res, randomBytes(32).toString('hex'));
    return { user: result.user };
  }
}
