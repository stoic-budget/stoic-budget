import { ConflictException, Logger } from '@nestjs/common';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { CalendarFeedService, hashFeedToken } from '@/modules/calendar-feed/calendar-feed.service';
import { createRepoMock } from '../../../helpers/create-repo-mock';

const STORED = {
  id: 'feed-1',
  workspaceId: 'ws-1',
  memberId: 'member-1',
  tokenHash: 'a'.repeat(64),
  includePayables: true,
  includeSubscriptions: true,
  includeTaxDeadlines: true,
  includeInvoices: true,
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
  lastFetchedAt: null,
};

/**
 * Two "turn on" or "new link" requests at once must not both answer a link:
 * the one whose write lost the race is a 409, never a token already replaced.
 */
describe('CalendarFeedService.issue', () => {
  let feeds: ReturnType<typeof createRepoMock>;
  let insert: { execute: ReturnType<typeof vi.fn> };
  let service: CalendarFeedService;
  let audit: { createEvent: ReturnType<typeof vi.fn> };

  beforeAll(() => Logger.overrideLogger(false));

  beforeEach(() => {
    feeds = createRepoMock();
    insert = { execute: vi.fn() };
    const chain = {
      insert: () => chain,
      into: () => chain,
      values: () => chain,
      orIgnore: () => chain,
      returning: () => chain,
      execute: insert.execute,
    };
    feeds.createQueryBuilder.mockReturnValue(chain);
    audit = { createEvent: vi.fn().mockResolvedValue(undefined) };
    service = new CalendarFeedService(feeds as never, audit as never);
  });

  /** The first read finds `before`; the read-back by token finds the row as it is then. */
  const reads = (before: typeof STORED | null, after: typeof STORED | null = STORED) =>
    feeds.findOne.mockResolvedValueOnce(before).mockResolvedValueOnce(after);

  it('renews a link only if it is still the one it read', async () => {
    reads(STORED);
    feeds.update.mockResolvedValue({ affected: 1 });
    const created = await service.issue('ws-1', 'member-1', 'user-1', {});
    expect(feeds.update).toHaveBeenCalledWith(
      { id: 'feed-1', workspaceId: 'ws-1', tokenHash: STORED.tokenHash },
      expect.objectContaining({ tokenHash: hashFeedToken(created.token) }),
    );
  });

  it('answers 409 when another request renewed or removed the link in between', async () => {
    reads(STORED);
    feeds.update.mockResolvedValue({ affected: 0 });
    await expect(service.issue('ws-1', 'member-1', 'user-1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(feeds.findOne).toHaveBeenCalledTimes(1);
  });

  it('turns the feed on with its own token', async () => {
    reads(null);
    insert.execute.mockResolvedValue({ raw: [{ id: 'feed-1' }] });
    const created = await service.issue('ws-1', 'member-1', 'user-1', {});
    expect(created.token).toEqual(expect.any(String));
    expect(created.enabled).toBe(true);
  });

  it('answers 409 when another request turned the feed on first', async () => {
    reads(null);
    insert.execute.mockResolvedValue({ raw: [] });
    await expect(service.issue('ws-1', 'member-1', 'user-1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(feeds.findOne).toHaveBeenCalledTimes(1);
  });

  it('answers 409 when another request renewed the link right after this write', async () => {
    // Our conditional write went through, then the other request replaced our token.
    reads(STORED, null);
    feeds.update.mockResolvedValue({ affected: 1 });
    await expect(service.issue('ws-1', 'member-1', 'user-1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    const readBack = feeds.findOne.mock.calls[1][0];
    const written = feeds.update.mock.calls[0][1].tokenHash;
    expect(readBack).toEqual({
      where: { workspaceId: 'ws-1', memberId: 'member-1', tokenHash: written },
    });
    expect(audit.createEvent).not.toHaveBeenCalled();
  });
});

/** Making, renewing and turning off a link are security events, like an API key. */
describe('CalendarFeedService audit', () => {
  let feeds: ReturnType<typeof createRepoMock>;
  let audit: { createEvent: ReturnType<typeof vi.fn> };
  let service: CalendarFeedService;

  beforeAll(() => Logger.overrideLogger(false));

  beforeEach(() => {
    feeds = createRepoMock();
    const chain = {
      insert: () => chain,
      into: () => chain,
      values: () => chain,
      orIgnore: () => chain,
      returning: () => chain,
      execute: vi.fn().mockResolvedValue({ raw: [{ id: 'feed-1' }] }),
    };
    feeds.createQueryBuilder.mockReturnValue(chain);
    feeds.update.mockResolvedValue({ affected: 1 });
    feeds.delete.mockResolvedValue({ affected: 1 });
    audit = { createEvent: vi.fn().mockResolvedValue(undefined) };
    service = new CalendarFeedService(feeds as never, audit as never);
  });

  const expectEvent = (action: AuditAction, secrets: string[]) => {
    expect(audit.createEvent).toHaveBeenCalledTimes(1);
    const event = audit.createEvent.mock.calls[0][0];
    expect(event).toMatchObject({
      workspaceId: 'ws-1',
      actorId: 'user-1',
      entityType: EntityType.CALENDAR_FEED,
      entityId: 'feed-1',
      action,
      severity: Severity.WARN,
    });
    for (const secret of secrets) expect(JSON.stringify(event)).not.toContain(secret);
  };

  it('records turning the feed on, without the token or its hash', async () => {
    feeds.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(STORED);
    const created = await service.issue('ws-1', 'member-1', 'user-1', {});
    expectEvent(AuditAction.CREATE, [created.token, hashFeedToken(created.token)]);
  });

  it('records a new link replacing the old one', async () => {
    feeds.findOne.mockResolvedValueOnce(STORED).mockResolvedValueOnce(STORED);
    const created = await service.issue('ws-1', 'member-1', 'user-1', {});
    expectEvent(AuditAction.UPDATE, [created.token, hashFeedToken(created.token), STORED.tokenHash]);
  });

  it('records turning the feed off, and nothing when it was already off', async () => {
    feeds.findOne.mockResolvedValueOnce(STORED);
    await service.remove('ws-1', 'member-1', 'user-1');
    expect(feeds.delete).toHaveBeenCalledWith({ id: 'feed-1', workspaceId: 'ws-1' });
    expectEvent(AuditAction.DELETE, [STORED.tokenHash]);

    audit.createEvent.mockClear();
    feeds.findOne.mockResolvedValueOnce(null);
    await service.remove('ws-1', 'member-1', 'user-1');
    expect(audit.createEvent).not.toHaveBeenCalled();
  });
});
