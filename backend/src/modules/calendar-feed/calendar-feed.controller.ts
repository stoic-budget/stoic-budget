import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import {
  CalendarFeedCreated,
  CalendarFeedIncludeBody,
  CalendarFeedSettings,
} from '../../contracts';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CalendarFeedService } from './calendar-feed.service';

/**
 * The caller's own calendar feed in the current workspace. Any member may
 * have one; what it shows is narrowed by their role when a calendar reads it.
 */
@Controller('calendar-feed')
export class CalendarFeedController {
  constructor(private readonly feeds: CalendarFeedService) {}

  @Get()
  @WorkspaceAuth()
  @SchemaResponse(CalendarFeedSettings)
  get(@WorkspaceId() workspaceId: string, @WorkspaceMemberId() memberId: string | null) {
    return this.feeds.get(workspaceId, memberId);
  }

  /** Turns the feed on, or makes a new link and revokes the old one. The link is in this answer only. */
  @Post()
  @WorkspaceAuth()
  @SchemaResponse(CalendarFeedCreated)
  issue(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @CurrentUser() user: User,
    @SchemaBody(CalendarFeedIncludeBody) body: CalendarFeedIncludeBody,
  ) {
    return this.feeds.issue(workspaceId, memberId, user.id, body);
  }

  @Patch()
  @WorkspaceAuth()
  @SchemaResponse(CalendarFeedSettings)
  update(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @SchemaBody(CalendarFeedIncludeBody) body: CalendarFeedIncludeBody,
  ) {
    return this.feeds.update(workspaceId, memberId, body);
  }

  /** Turns the feed off: the link stops working. */
  @Delete()
  @WorkspaceAuth()
  @SchemaResponse(CalendarFeedSettings)
  remove(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @CurrentUser() user: User,
  ) {
    return this.feeds.remove(workspaceId, memberId, user.id);
  }
}
