import { NotFoundException } from '@nestjs/common';
import { Permission } from '@/common/enums/permissions.enum';
import { UserRole } from '@/entities/user.entity';
import { WorkspaceRole } from '@/entities/workspace-member.entity';
import type { FeedKinds } from '@/modules/calendar-feed/calendar-feed-events.service';
import { PublicCalendarFeedService } from '@/modules/calendar-feed/public-calendar-feed.service';
import { createRepoMock } from '../../../helpers/create-repo-mock';

const ALL_ON = {
  id: 'feed-1',
  workspaceId: 'ws-1',
  memberId: 'member-1',
  includePayables: true,
  includeSubscriptions: true,
  includeTaxDeadlines: true,
  includeInvoices: true,
};

describe('PublicCalendarFeedService', () => {
  let feeds: { findByToken: ReturnType<typeof vi.fn>; markFetched: ReturnType<typeof vi.fn> };
  let events: { events: ReturnType<typeof vi.fn> };
  let members: ReturnType<typeof createRepoMock>;
  let service: PublicCalendarFeedService;

  const member = (overrides: Record<string, unknown> = {}, user: Record<string, unknown> = {}) => ({
    id: 'member-1',
    workspaceId: 'ws-1',
    role: WorkspaceRole.MEMBER,
    permissions: null,
    user: { role: UserRole.USER, permissions: null, isActive: true, deletedAt: null, locale: 'en', ...user },
    ...overrides,
  });
  const kindsAsked = (): FeedKinds => events.events.mock.calls[0][1];

  beforeEach(() => {
    feeds = { findByToken: vi.fn().mockResolvedValue(ALL_ON), markFetched: vi.fn() };
    events = { events: vi.fn().mockResolvedValue([]) };
    members = createRepoMock();
    service = new PublicCalendarFeedService(feeds as never, events as never, members as never);
  });

  it('reads the member in the feed’s own workspace only', async () => {
    members.findOne.mockResolvedValue(member());
    await service.render('token-for-member-one');
    expect(members.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'member-1', workspaceId: 'ws-1' } }),
    );
    expect(events.events.mock.calls[0][0]).toEqual(
      expect.objectContaining({ workspaceId: 'ws-1', memberId: 'member-1' }),
    );
  });

  it('carries every kind a plain member chose', async () => {
    members.findOne.mockResolvedValue(member());
    await service.render('token-for-member-one');
    expect(kindsAsked()).toEqual({
      payables: true,
      subscriptions: true,
      taxDeadlines: true,
      invoices: true,
    });
  });

  it('drops the kinds the reader may no longer see, whatever the feed was set to', async () => {
    // Every workspace role reads everything today; a membership without one, on an account
    // limited to bills, is what is left to narrow.
    members.findOne.mockResolvedValue(
      member({ role: null }, { permissions: [Permission.PAYABLE_VIEW] }),
    );
    await service.render('token-for-member-one');
    expect(kindsAsked()).toEqual({
      payables: true,
      subscriptions: false,
      taxDeadlines: false,
      invoices: false,
    });
  });

  it('drops bills from a reader who may no longer see them', async () => {
    members.findOne.mockResolvedValue(
      member({ role: null }, { permissions: [Permission.SUBSCRIPTION_VIEW, Permission.INVOICE_VIEW] }),
    );
    await service.render('token-for-member-one');
    expect(kindsAsked()).toEqual({
      payables: false,
      subscriptions: true,
      taxDeadlines: false,
      invoices: true,
    });
  });

  it('answers 404 for an unknown token, a missing member or a disabled account', async () => {
    feeds.findByToken.mockResolvedValueOnce(null);
    await expect(service.render('unknown-token-value')).rejects.toBeInstanceOf(NotFoundException);

    members.findOne.mockResolvedValueOnce(null);
    await expect(service.render('token-for-member-one')).rejects.toBeInstanceOf(NotFoundException);

    members.findOne.mockResolvedValueOnce(member({}, { isActive: false }));
    await expect(service.render('token-for-member-one')).rejects.toBeInstanceOf(NotFoundException);

    members.findOne.mockResolvedValueOnce(member({}, { deletedAt: new Date() }));
    await expect(service.render('token-for-member-one')).rejects.toBeInstanceOf(NotFoundException);
    expect(events.events).not.toHaveBeenCalled();
    expect(feeds.markFetched).not.toHaveBeenCalled();
  });
});
