import { BackupDestinationKind, BackupRunTrigger } from '../../../../src/entities';
import { BackupSchedulerService } from '../../../../src/modules/backups/backup-scheduler.service';

describe('BackupSchedulerService', () => {
  it('runs an enabled configuration at its scheduled local minute only once', async () => {
    const configuration = {
      id: 'config-1',
      workspaceId: 'workspace-1',
      dailyTime: '03:00',
      timeZone: 'Asia/Jerusalem',
      enabled: true,
      destinationKind: BackupDestinationKind.LOCAL,
    };
    const configurations = { find: vi.fn().mockResolvedValue([configuration]) };
    const workspaces = { findOne: vi.fn().mockResolvedValue({ id: 'workspace-1' }) };
    const backups = { runConfiguration: vi.fn().mockResolvedValue(undefined) };
    const scheduler = new BackupSchedulerService(configurations as never, workspaces as never, backups as never, { create: vi.fn() } as never);
    const now = new Date('2026-01-01T01:00:00.000Z');

    await scheduler.runDueBackups(now);
    await scheduler.runDueBackups(now);

    expect(backups.runConfiguration).toHaveBeenCalledTimes(1);
    expect(backups.runConfiguration).toHaveBeenCalledWith(
      { id: 'workspace-1' },
      configuration,
      BackupRunTrigger.SCHEDULED,
    );
  });

  it('skips disabled configurations and configurations outside their local scheduled minute', async () => {
    const configurations = {
      find: vi.fn().mockResolvedValue([
        { id: 'disabled', workspaceId: 'one', dailyTime: '03:00', timeZone: 'Asia/Jerusalem', enabled: false },
        { id: 'later', workspaceId: 'two', dailyTime: '04:00', timeZone: 'Asia/Jerusalem', enabled: true },
      ]),
    };
    const workspaces = { findOne: vi.fn() };
    const backups = { runConfiguration: vi.fn() };
    const scheduler = new BackupSchedulerService(configurations as never, workspaces as never, backups as never, { create: vi.fn() } as never);

    await scheduler.runDueBackups(new Date('2026-01-01T01:00:00.000Z'));

    expect(workspaces.findOne).not.toHaveBeenCalled();
    expect(backups.runConfiguration).not.toHaveBeenCalled();
  });

  it('tells the owner when a scheduled backup fails, and nobody when it runs (#639)', async () => {
    const configuration = {
      id: 'config-1',
      workspaceId: 'workspace-1',
      dailyTime: '03:00',
      timeZone: 'Asia/Jerusalem',
      enabled: true,
    };
    const workspace = { id: 'workspace-1', name: 'ACME Household', ownerId: 'owner-1' };
    const run = async (runConfiguration: () => Promise<unknown>) => {
      const notifications = { create: vi.fn(async () => undefined) };
      await new BackupSchedulerService(
        { find: vi.fn().mockResolvedValue([configuration]) } as never,
        { findOne: vi.fn().mockResolvedValue(workspace) } as never,
        { runConfiguration: vi.fn(runConfiguration) } as never,
        notifications as never,
      ).runDueBackups(new Date('2026-01-01T01:00:00.000Z'));
      return notifications.create;
    };

    const failed = await run(async () => {
      throw new Error('Destination full');
    });
    const ran = await run(async () => undefined);

    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'owner-1',
        workspaceId: 'workspace-1',
        type: 'backup.failed',
        messageKey: 'backup.failed',
        messageParams: { workspace: 'ACME Household' },
      }),
    );
    expect(ran).not.toHaveBeenCalled();
  });

  it('goes on to the next configuration when a workspace cannot be read', async () => {
    const due = (id: string) => ({ id, workspaceId: `ws-${id}`, dailyTime: '03:00', timeZone: 'Asia/Jerusalem', enabled: true });
    const findOne = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce({ id: 'ws-2', name: 'ACME', ownerId: 'owner-2' });
    const backups = { runConfiguration: vi.fn(async () => undefined) };

    await new BackupSchedulerService(
      { find: vi.fn().mockResolvedValue([due('1'), due('2')]) } as never,
      { findOne } as never,
      backups as never,
      { create: vi.fn() } as never,
    ).runDueBackups(new Date('2026-01-01T01:00:00.000Z'));

    expect(backups.runConfiguration).toHaveBeenCalledTimes(1);
  });
});
