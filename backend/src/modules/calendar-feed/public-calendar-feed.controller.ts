import { Controller, Get, Header, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SchemaParams } from '../../common/effect/schema-query';
import { PublicCalendarParams } from '../../contracts';
import { Public } from '../auth/decorators/public.decorator';
import { PublicCalendarFeedService } from './public-calendar-feed.service';

/**
 * The calendar feed a calendar app subscribes to. No JWT and no workspace
 * header: the token in the url is the only thing granting access, as with a
 * shared invoice.
 */
@Controller('public/calendar')
export class PublicCalendarFeedController {
  constructor(private readonly feed: PublicCalendarFeedService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token.ics')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'no-store')
  async ics(
    @SchemaParams(PublicCalendarParams) { token }: PublicCalendarParams,
    @Res() res: Response,
  ) {
    const body = await this.feed.render(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
    res.send(body);
  }
}
