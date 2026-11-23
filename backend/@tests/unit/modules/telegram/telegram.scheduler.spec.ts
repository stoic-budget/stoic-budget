import { InsightSeverity } from '@/entities/insight.entity';
import { TelegramScheduler } from '@/modules/telegram/telegram.scheduler';

function createUserRepoMock(users: unknown[]) {
  return { find: vi.fn(async () => users) } as any;
}

describe('TelegramScheduler.pushInsightDigests', () => {
  it('pushes only the newly-created warn/critical insights, per connected user', async () => {
    const telegramService = {
      pushInsightDigest: vi.fn(async () => undefined),
      resolveWorkspaceId: vi.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = {
      refresh: vi.fn(async () => ({
        created: 2,
        updated: 1,
        total: 3,
        newInsights: [
          { id: 'i-1', severity: InsightSeverity.WARN },
          { id: 'i-2', severity: InsightSeverity.INFO },
        ],
      })),
    } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: 'workspace-1', telegramChatId: 'chat-1' },
    ]);
    const auditService = { createEvent: vi.fn() } as any;

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      auditService,
    );

    await scheduler.pushInsightDigests();

    expect(insightsService.refresh).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(telegramService.pushInsightDigest).toHaveBeenCalledTimes(1);
    const [, pushedInsights] = telegramService.pushInsightDigest.mock.calls[0];
    expect(pushedInsights).toEqual([{ id: 'i-1', severity: InsightSeverity.WARN }]);
  });

  it('skips users with no workspace, since insights are workspace-scoped', async () => {
    const telegramService = {
      pushInsightDigest: vi.fn(async () => undefined),
      resolveWorkspaceId: vi.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = { refresh: vi.fn() } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: null, telegramChatId: 'chat-1' },
    ]);

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      { createEvent: vi.fn() } as any,
    );

    await scheduler.pushInsightDigests();

    expect(insightsService.refresh).not.toHaveBeenCalled();
  });

  it('stays quiet when nothing new crossed the warn/critical bar', async () => {
    const telegramService = {
      pushInsightDigest: vi.fn(async () => undefined),
      resolveWorkspaceId: vi.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = {
      refresh: vi.fn(async () => ({
        created: 1,
        updated: 0,
        total: 1,
        newInsights: [{ id: 'i-1', severity: InsightSeverity.INFO }],
      })),
    } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: 'workspace-1', telegramChatId: 'chat-1' },
    ]);

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      { createEvent: vi.fn() } as any,
    );

    await scheduler.pushInsightDigests();

    expect(telegramService.pushInsightDigest).not.toHaveBeenCalled();
  });

  it('keeps checking other users after one fails', async () => {
    const telegramService = {
      pushInsightDigest: vi.fn(async () => undefined),
      resolveWorkspaceId: vi.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = {
      refresh: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({
          created: 1,
          updated: 0,
          total: 1,
          newInsights: [{ id: 'i-2', severity: InsightSeverity.CRITICAL }],
        }),
    } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: 'workspace-1', telegramChatId: 'chat-1' },
      { id: 'user-2', workspaceId: 'workspace-2', telegramChatId: 'chat-2' },
    ]);

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      { createEvent: vi.fn() } as any,
    );

    await scheduler.pushInsightDigests();

    expect(insightsService.refresh).toHaveBeenCalledTimes(2);
    expect(telegramService.pushInsightDigest).toHaveBeenCalledTimes(1);
  });
});

describe('TelegramScheduler scheduled reports', () => {
  const build = () => {
    const telegramService = {
      sendReport: vi.fn(async () => ({ status: 'sent' })),
      resolveWorkspaceId: vi.fn(async () => 'workspace-1'),
    } as any;
    const reportRepository = { findOne: vi.fn(async (): Promise<unknown> => null) };
    const scheduler = new TelegramScheduler(
      telegramService,
      {} as any,
      createUserRepoMock([{ id: 'user-1', telegramChatId: 'chat-1' }]),
      { createEvent: vi.fn(async () => undefined) } as any,
      reportRepository as any,
    );
    return { scheduler, telegramService, reportRepository };
  };

  afterEach(() => vi.useRealTimers());

  it('sends the month that ended on the 1st', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T09:00:00Z'));
    const { scheduler, telegramService } = build();

    await scheduler.sendMonthlyReports();

    expect(telegramService.sendReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ year: 2026, month: 12 }),
      'workspace-1',
    );
  });

  it('sends the day that ended at 8 in the morning', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T08:00:00Z'));
    const { scheduler, telegramService } = build();

    await scheduler.sendDailyReports();

    expect(telegramService.sendReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ date: '2026-11-30' }),
      'workspace-1',
    );
  });

  it('skips a period already delivered after it ended, so a restart does not send it twice', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T09:00:00Z'));
    const { scheduler, telegramService, reportRepository } = build();
    reportRepository.findOne.mockResolvedValue({ status: 'sent', sentAt: new Date('2026-12-01T08:00:30Z') });

    await scheduler.sendMonthlyReports();
    await scheduler.sendDailyReports();

    expect(telegramService.sendReport).not.toHaveBeenCalled();
  });

  it('still sends the period when the only delivery was asked for before it ended', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T09:00:00Z'));
    const { scheduler, telegramService, reportRepository } = build();
    // `/report` on 15 November: a partial month, not the report of November.
    reportRepository.findOne.mockResolvedValue({ status: 'sent', sentAt: new Date('2026-11-15T10:00:00Z') });

    await scheduler.sendMonthlyReports();

    expect(telegramService.sendReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ year: 2026, month: 11 }),
      'workspace-1',
    );
  });
});
