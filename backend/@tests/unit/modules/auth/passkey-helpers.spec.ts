import type { Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { WorkspaceRole } from '@/entities';
import type { AuditService } from '@/modules/audit/audit.service';
import { recordPasskeyEvent } from '@/modules/auth/passkeys/passkey-helpers';

const HOME = 'workspace-home';
const JOINED = 'workspace-joined';
const OWNED = 'workspace-owned';

describe('recordPasskeyEvent', () => {
  const setup = (memberships: Array<{ workspaceId: string; role: WorkspaceRole }>) => {
    const auditService = { createEvent: vi.fn().mockResolvedValue(undefined) };
    const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const find = vi.fn().mockResolvedValue(memberships);
    const manager = { getRepository: vi.fn(() => ({ find })) };
    const record = (workspaceId: string | null, event: 'added' | 'removed' | 'counter_regression') =>
      recordPasskeyEvent(
        auditService as unknown as AuditService,
        logger as unknown as Logger,
        manager as unknown as EntityManager,
        { id: 'user-1', workspaceId },
        event,
        'passkey-1',
      );
    const filedIn = () => auditService.createEvent.mock.calls.map(([event]) => event.workspaceId);
    return { auditService, logger, find, record, filedIn };
  };

  it('files the event in the home workspace without looking further', async () => {
    const { record, filedIn, find } = setup([{ workspaceId: JOINED, role: WorkspaceRole.MEMBER }]);
    await record(HOME, 'added');
    expect(filedIn()).toEqual([HOME]);
    expect(find).not.toHaveBeenCalled();
  });

  it('files it in a workspace the user owns, else the one joined first, once home is gone', async () => {
    const owner = setup([
      { workspaceId: JOINED, role: WorkspaceRole.MEMBER },
      { workspaceId: OWNED, role: WorkspaceRole.OWNER },
    ]);
    await owner.record(null, 'counter_regression');
    expect(owner.filedIn()).toEqual([OWNED]);
    expect(owner.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' }, order: { createdAt: 'ASC' } }),
    );

    const member = setup([
      { workspaceId: JOINED, role: WorkspaceRole.MEMBER },
      { workspaceId: OWNED, role: WorkspaceRole.VIEWER },
    ]);
    await member.record(null, 'removed');
    expect(member.filedIn()).toEqual([JOINED]);
  });

  it('logs the event loudly instead of dropping it when the user is in no workspace', async () => {
    const { record, auditService, logger } = setup([]);
    await record(null, 'counter_regression');
    await record(null, 'added');
    expect(auditService.createEvent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('counter_regression'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('user-1'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('added'));
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
