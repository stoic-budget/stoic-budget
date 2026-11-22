import { Injectable } from '@nestjs/common';
import type { McpOAuthRevokeReason } from '../../../entities/mcp-oauth-grant.entity';
import { CalendarFeedRevocationService } from '../../calendar-feed/calendar-feed-revocation.service';
import { McpOAuthGrantsService } from '../../mcp-oauth/mcp-oauth-grants.service';

/** Why everything a user handed out ends at once. */
export type StandingAccessEnd = Extract<
  McpOAuthRevokeReason,
  'logout_all' | 'password_changed' | 'deactivated'
>;

/**
 * Access that outlives a session: calendar feed links and the apps connected
 * over MCP, in every workspace. Signing out everywhere, changing the password
 * or being deactivated ends them along with the sessions, for good.
 */
@Injectable()
export class StandingAccessService {
  constructor(
    private readonly calendarFeeds: CalendarFeedRevocationService,
    private readonly mcpOAuthGrants: McpOAuthGrantsService,
  ) {}

  async endAllOf(userId: string, reason: StandingAccessEnd): Promise<void> {
    await this.calendarFeeds.revokeAllOf(userId);
    await this.mcpOAuthGrants.revokeAllOfUser(userId, reason);
  }
}
