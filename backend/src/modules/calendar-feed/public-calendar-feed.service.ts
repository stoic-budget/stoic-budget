import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { hasPermissions } from '../../common/authz/request-permissions';
import { APP_NAME } from '../../common/brand';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { localDay } from '../../common/recurrence/date-only';
import type { CalendarFeed } from '../../entities/calendar-feed.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { CalendarFeedService } from './calendar-feed.service';
import { CalendarFeedEventsService, type FeedKinds } from './calendar-feed-events.service';
import type { FeedContext } from './calendar-feed-format';
import { calendarFeedLabels } from './calendar-feed-translations';
import { buildCalendar } from './ics-writer';

/**
 * The feed behind a link, as an iCalendar file. No session: the token is the
 * whole credential, so it answers only the token's workspace and member, in
 * that member's language, and only the kinds their role may still see.
 */
@Injectable()
export class PublicCalendarFeedService {
  constructor(
    private readonly feeds: CalendarFeedService,
    private readonly events: CalendarFeedEventsService,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
  ) {}

  async render(token: string, now = new Date()): Promise<string> {
    const feed = await this.feeds.findByToken(token);
    const member = feed ? await this.memberOf(feed) : null;
    // An unknown, revoked or orphaned link looks the same: nothing here.
    if (!(feed && member?.user?.isActive) || member.user.deletedAt) {
      throw new NotFoundException(appError('CALENDAR_FEED_NOT_FOUND'));
    }
    const locale = member.user.locale || 'en';
    const labels = calendarFeedLabels(locale);
    const context: FeedContext = {
      workspaceId: feed.workspaceId,
      memberId: member.id,
      locale,
      labels,
      today: localDay(now),
    };
    const events = await this.events.events(context, this.kindsFor(feed, member));
    await this.feeds.markFetched(feed);
    return buildCalendar({
      prodId: `-//${APP_NAME}//Calendar feed//EN`,
      name: `${APP_NAME} · ${labels.calendarName}`,
      stamp: now,
      events,
    });
  }

  private memberOf(feed: CalendarFeed): Promise<WorkspaceMember | null> {
    return this.memberRepository.findOne({
      where: { id: feed.memberId, workspaceId: feed.workspaceId },
      relations: { user: true },
    });
  }

  /** The member's choice, each kind also needing the permission its page needs today. */
  private kindsFor(feed: CalendarFeed, member: WorkspaceMember): FeedKinds {
    const may = (permission: Permission) =>
      hasPermissions([permission], {
        user: member.user,
        workspaceRole: member.role,
        workspaceMemberPermissions: member.permissions,
      });
    return {
      payables: feed.includePayables && may(Permission.PAYABLE_VIEW),
      subscriptions: feed.includeSubscriptions && may(Permission.SUBSCRIPTION_VIEW),
      taxDeadlines: feed.includeTaxDeadlines && may(Permission.REPORT_VIEW),
      invoices: feed.includeInvoices && may(Permission.INVOICE_VIEW),
    };
  }
}
