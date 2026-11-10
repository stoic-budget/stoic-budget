import type { Mock } from 'vitest';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { AuthSession } from '@/entities/auth-session.entity';
import { PasswordResetToken } from '@/entities/password-reset-token.entity';
import { User } from '@/entities/user.entity';
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';

const SECRET = 'test-reset-secret';

describe('PasswordResetService', () => {
  let manager: { update: Mock; increment: Mock; createQueryBuilder: Mock };
  let userRepository: {
    findOne: Mock;
    save: Mock;
    manager: { transaction: Mock };
  };
  let tokenRepository: {
    findOne: Mock;
    save: Mock;
    create: Mock;
    delete: Mock;
  };
  let passkeyRepository: { find: Mock };
  let passkeysService: { reportRemoved: Mock };
  let mailerService: { send: Mock };
  let auditService: { createEvent: Mock };
  let service: PasswordResetService;

  const activeUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    isActive: true,
    tokenVersion: 3,
    workspaceId: 'ws-1',
  };

  beforeEach(() => {
    manager = {
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      increment: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn(),
    };
    userRepository = {
      findOne: vi.fn(),
      save: vi.fn(async u => u),
      manager: { transaction: vi.fn(async (work: (m: typeof manager) => unknown) => work(manager)) },
    };
    tokenRepository = {
      findOne: vi.fn(),
      save: vi.fn(async t => t),
      create: vi.fn(t => t),
      delete: vi.fn(),
    };
    passkeyRepository = { find: vi.fn().mockResolvedValue([]) };
    passkeysService = { reportRemoved: vi.fn() };
    mailerService = { send: vi.fn().mockResolvedValue(true) };
    auditService = { createEvent: vi.fn().mockResolvedValue({}) };

    service = new PasswordResetService(
      userRepository as never,
      tokenRepository as never,
      passkeyRepository as never,
      mailerService as never,
      { get: (key: string) => (key === 'JWT_SECRET' ? SECRET : undefined) } as never,
      auditService as never,
      passkeysService as never,
    );
  });

  describe('requestReset', () => {
    it('emails a link and stores only the hash of the token', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);

      await service.requestReset('user@example.com');

      const stored = tokenRepository.save.mock.calls[0][0];
      const sentText = mailerService.send.mock.calls[0][0].text as string;
      const tokenInEmail = decodeURIComponent(
        /token=([^\s]+)/.exec(sentText)?.[1] ?? '',
      );

      expect(tokenInEmail).toHaveLength(64);
      // What lands in the database must not be usable as a reset link.
      expect(stored.tokenHash).not.toBe(tokenInEmail);
      expect(stored.tokenHash).toHaveLength(64);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
      // Account mail: the mailer picks a server the user controls (getAccountSmtpSettings).
      expect(mailerService.send.mock.calls[0][0].accountOf).toBe(activeUser);
    });

    it('supersedes any outstanding request for the same user', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);

      await service.requestReset('user@example.com');

      expect(tokenRepository.delete).toHaveBeenCalledWith({ userId: 'user-1', usedAt: IsNull() });
    });

    it('does nothing and still resolves for an unknown address', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.requestReset('nobody@example.com')).resolves.toBeUndefined();

      expect(tokenRepository.save).not.toHaveBeenCalled();
      expect(mailerService.send).not.toHaveBeenCalled();
    });

    it('does nothing for a deactivated account', async () => {
      userRepository.findOne.mockResolvedValue({ ...activeUser, isActive: false });

      await service.requestReset('user@example.com');

      expect(tokenRepository.save).not.toHaveBeenCalled();
    });

    // The neutral response is worthless if a mail failure surfaces as an error:
    // that alone would reveal which addresses exist.
    it('resolves even when sending the email throws', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);
      mailerService.send.mockRejectedValue(new Error('smtp is down'));

      await expect(service.requestReset('user@example.com')).resolves.toBeUndefined();
    });

    it('resolves when SMTP is not configured at all', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);
      mailerService.send.mockResolvedValue(false);

      await expect(service.requestReset('user@example.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    const validRecord = () => ({
      id: 'token-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it('sets the new password, burns the token and revokes every session', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ ...activeUser });

      await service.resetPassword('plain-token', 'BrandNewPass1');

      // All in one transaction, the link claimed only while still unused.
      expect(userRepository.manager.transaction).toHaveBeenCalledTimes(1);
      expect(manager.update).toHaveBeenCalledWith(
        PasswordResetToken,
        { id: 'token-1', usedAt: IsNull() },
        { usedAt: expect.any(Date) },
      );
      expect(manager.update).toHaveBeenCalledWith(
        User,
        { id: 'user-1' },
        { passwordHash: expect.stringMatching(/^\$2[aby]\$/) },
      );
      // Every issued token stops verifying.
      expect(manager.increment).toHaveBeenCalledWith(User, { id: 'user-1' }, 'tokenVersion', 1);
      // IsNull(), not a literal null — a literal never matches in TypeORM.
      expect(manager.update).toHaveBeenCalledWith(
        AuthSession,
        { userId: 'user-1', revokedAt: IsNull() },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      // No passkeys chosen: none touched, none reported.
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(passkeysService.reportRemoved).not.toHaveBeenCalled();
    });

    it('refuses a link another submit claimed first, before anything is logged', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ ...activeUser });
      manager.update.mockResolvedValueOnce({ affected: 0 });

      await expect(service.resetPassword('plain-token', 'BrandNewPass1')).rejects.toThrow(
        BadRequestException,
      );
      expect(manager.update).toHaveBeenCalledTimes(1);
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('logs the completed reset without the password, hash or token', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ ...activeUser });

      await service.resetPassword('plain-token', 'BrandNewPass1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.USER,
          entityId: 'user-1',
          action: AuditAction.UPDATE,
          severity: Severity.WARN,
          meta: { password: 'reset', sessions: 'all-revoked' },
        }),
      );
      const payload = JSON.stringify(auditService.createEvent.mock.calls);
      const { passwordHash } = manager.update.mock.calls.find(([target]) => target === User)?.[2];
      for (const leaked of ['plain-token', 'BrandNewPass1', passwordHash]) {
        expect(payload).not.toContain(leaked);
      }
    });

    it('completes the reset when the audit write fails', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ ...activeUser });
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.resetPassword('plain-token', 'BrandNewPass1')).resolves.toBeUndefined();
      expect(manager.update).toHaveBeenCalledWith(
        PasswordResetToken,
        expect.anything(),
        { usedAt: expect.any(Date) },
      );
    });

    it('rejects a token that was already used', async () => {
      tokenRepository.findOne.mockResolvedValue({ ...validRecord(), usedAt: new Date() });

      await expect(service.resetPassword('plain-token', 'BrandNewPass1')).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepository.manager.transaction).not.toHaveBeenCalled();
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      tokenRepository.findOne.mockResolvedValue({
        ...validRecord(),
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword('plain-token', 'BrandNewPass1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown token', async () => {
      tokenRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('nope', 'BrandNewPass1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('gives the same message for every failure mode', async () => {
      const messages: string[] = [];
      for (const record of [
        null,
        { ...validRecord(), usedAt: new Date() },
        { ...validRecord(), expiresAt: new Date(Date.now() - 1000) },
      ]) {
        tokenRepository.findOne.mockResolvedValue(record);
        await service.resetPassword('t', 'BrandNewPass1').catch((error: Error) => {
          messages.push(error.message);
        });
      }

      expect(new Set(messages).size).toBe(1);
    });

    it('looks the token up by its hash, never by the plaintext', async () => {
      tokenRepository.findOne.mockResolvedValue(null);

      await service.resetPassword('plain-token', 'BrandNewPass1').catch(() => undefined);

      const where = tokenRepository.findOne.mock.calls[0][0].where;
      expect(where.tokenHash).not.toBe('plain-token');
      expect(where.tokenHash).toHaveLength(64);
    });
  });

  describe('listPasskeys', () => {
    const record = () => ({
      id: 'token-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it("lists the link's account passkeys and leaves the link unspent", async () => {
      tokenRepository.findOne.mockResolvedValue(record());
      userRepository.findOne.mockResolvedValue({ ...activeUser });
      passkeyRepository.find.mockResolvedValue([
        {
          id: 'pk-1',
          name: 'Laptop',
          deviceType: 'multiDevice',
          backedUp: true,
          createdAt: new Date('2026-11-01T10:00:00Z'),
          lastUsedAt: null,
          credentialId: 'secret-credential-id',
          signCount: 7,
        },
      ]);

      await expect(service.listPasskeys('plain-token')).resolves.toEqual([
        {
          id: 'pk-1',
          name: 'Laptop',
          deviceType: 'multiDevice',
          backedUp: true,
          createdAt: '2026-11-01T10:00:00.000Z',
          lastUsedAt: null,
        },
      ]);
      expect(passkeyRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(tokenRepository.save).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('answers a bad link exactly as the reset does, and lists nothing', async () => {
      const failures: string[] = [];
      for (const bad of [
        null,
        { ...record(), usedAt: new Date() },
        { ...record(), expiresAt: new Date(Date.now() - 1000) },
      ]) {
        tokenRepository.findOne.mockResolvedValue(bad);
        for (const attempt of [
          service.listPasskeys('t'),
          service.resetPassword('t', 'BrandNewPass1'),
        ]) {
          await attempt.catch((error: BadRequestException) => {
            failures.push(JSON.stringify(error.getResponse()));
          });
        }
      }
      expect(failures).toHaveLength(6);
      expect(new Set(failures).size).toBe(1);
      expect(passkeyRepository.find).not.toHaveBeenCalled();
    });
  });
});
