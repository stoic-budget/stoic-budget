import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { WorkspaceServiceSettingsKey } from '@/entities';
import { AuditAction } from '@/entities/audit-event.entity';
import { SmtpSettingsService } from '@/modules/application-settings/smtp-settings.service';
import { storedSmtpForSameServer } from '@/modules/application-settings/smtp-stored-secret';

describe('SmtpSettingsService', () => {
  const accountPassword = 'Member-One-password-1';
  const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;
  const body = {
    host: 'mail.example.com',
    port: 587,
    user: 'smtp-login-1',
    pass: 'smtp-secret',
    from: 'Member One <member-1@example.com>',
  };
  const status = {
    connected: true,
    status: 'connected',
    source: 'workspace',
    settings: { host: body.host, port: body.port, user: body.user, from: body.from },
  };
  let passwordHash: string;
  let steps: string[];
  let applicationSettings: Record<string, ReturnType<typeof vi.fn>>;
  let auditService: { createEvent: ReturnType<typeof vi.fn> };

  const service = () =>
    new SmtpSettingsService(
      applicationSettings as never,
      { findOne: vi.fn(async () => ({ id: 'user-1', passwordHash })) } as never,
      auditService as never,
    );
  const auditedMeta = () => auditService.createEvent.mock.calls.map(([event]) => event.meta);

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(accountPassword, 4);
  });

  beforeEach(() => {
    steps = [];
    applicationSettings = {
      saveSmtpSettings: vi.fn(async () => {
        steps.push('save');
        return status;
      }),
      getSmtpStatus: vi.fn(async () => status),
      disconnect: vi.fn(async () => ({ ok: true })),
    };
    auditService = {
      createEvent: vi.fn(async () => {
        steps.push('audit');
      }),
    };
  });

  it('refuses a wrong password before it saves or tries the server, and audits the refusal', async () => {
    await expect(
      service().save(user, { ...body, currentPassword: 'not-the-password' }, 'workspace-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(applicationSettings.saveSmtpSettings).not.toHaveBeenCalled();
    expect(steps).toEqual(['audit']);
    expect(auditedMeta()).toEqual([
      { smtp: 'refused', host: body.host, port: body.port, from: body.from },
    ]);
  });

  it('refuses every password for an account without a password hash', async () => {
    passwordHash = '';
    await expect(
      service().save(user, { ...body, currentPassword: 'anything' }, 'workspace-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    passwordHash = await bcrypt.hash(accountPassword, 4);
  });

  it('saves with the right password, without handing the password on, and audits the server', async () => {
    await service().save(user, { ...body, currentPassword: accountPassword }, 'workspace-1');

    expect(steps).toEqual(['save', 'audit']);
    const [, settings, workspaceId] = applicationSettings.saveSmtpSettings.mock.calls[0];
    expect(settings).toEqual(body);
    expect(workspaceId).toBe('workspace-1');
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        actorId: 'user-1',
        action: AuditAction.UPDATE,
      }),
    );
    expect(auditedMeta()).toEqual([
      { smtp: 'saved', host: body.host, port: body.port, from: body.from },
    ]);
  });

  it('removes without a password and audits which server went', async () => {
    await expect(service().remove(user, 'workspace-1')).resolves.toEqual({ ok: true });

    expect(applicationSettings.disconnect).toHaveBeenCalledWith(
      user,
      WorkspaceServiceSettingsKey.SMTP,
      'workspace-1',
    );
    expect(auditedMeta()).toEqual([
      { smtp: 'removed', host: body.host, port: body.port, from: body.from },
    ]);
  });

  it('never writes the SMTP user, its password or the account password to the audit trail', async () => {
    const run = service();
    await run.save(user, { ...body, currentPassword: 'not-the-password' }, 'workspace-1').catch(() => {});
    await run.save(user, { ...body, currentPassword: accountPassword }, 'workspace-1');
    await run.remove(user, 'workspace-1');

    const written = JSON.stringify(auditService.createEvent.mock.calls);
    for (const secret of [body.user, body.pass, accountPassword, 'not-the-password']) {
      expect(written).not.toContain(secret);
    }
  });
});

describe('storedSmtpForSameServer', () => {
  const stored = {
    config: { host: 'mail.example.com', port: 587, user: 'member-1@example.com' },
  };
  const next = { host: 'mail.example.com', port: 587, user: 'member-1@example.com' };

  it('keeps the row for the same server and account, whatever the host case', () => {
    expect(storedSmtpForSameServer(stored, next)).toBe(stored);
    expect(storedSmtpForSameServer(stored, { ...next, host: 'Mail.Example.COM' })).toBe(stored);
  });

  it.each([
    ['host', { host: 'mail.elsewhere.example' }],
    ['port', { port: 465 }],
    ['user', { user: 'member-2@example.com' }],
    ['user removed', { user: undefined }],
  ])('drops it when the %s differs', (_, change) => {
    expect(storedSmtpForSameServer(stored, { ...next, ...change })).toBeNull();
  });

  it('keeps a row saved without a user only for a save without one', () => {
    const anonymous = { config: { host: 'mail.example.com', port: 587 } };
    expect(storedSmtpForSameServer(anonymous, { ...next, user: undefined })).toBe(anonymous);
    expect(storedSmtpForSameServer(anonymous, next)).toBeNull();
  });

  it('has nothing to keep without a stored row', () => {
    expect(storedSmtpForSameServer(null, next)).toBeNull();
  });
});
