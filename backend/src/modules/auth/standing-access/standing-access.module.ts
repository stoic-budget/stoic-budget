import { Module } from '@nestjs/common';
import { CalendarFeedRevocationModule } from '../../calendar-feed/calendar-feed-revocation.module';
import { McpOAuthModule } from '../../mcp-oauth/mcp-oauth.module';
import { StandingAccessService } from './standing-access.service';

/** For the auth and users modules: ending a user's calendar links and connected apps. */
@Module({
  imports: [CalendarFeedRevocationModule, McpOAuthModule],
  providers: [StandingAccessService],
  exports: [StandingAccessService],
})
export class StandingAccessModule {}
