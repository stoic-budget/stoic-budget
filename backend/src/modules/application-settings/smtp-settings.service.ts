import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { SaveSmtpSettingsBody } from '../../contracts';
import { User, WorkspaceServiceSettingsKey } from '../../entities';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';
import { ApplicationSettingsService } from './application-settings.service';

/** What the audit trail keeps of an SMTP server: never the user, its password or the caller's. */
type SmtpAuditFields = { host?: unknown; port?: unknown; from?: unknown };

const NO_SERVER: SmtpAuditFields = { host: null, port: null, from: null };

/**
 * Saving and removing a workspace's SMTP server. That server may send the
 * saver's own password-reset and e-mail-change mail (getAccountSmtpSettings),
 * so a save asks for the caller's account password before anything else: a
 * stolen session alone must not be able to point it at a server it reads.
 */
@Injectable()
export class SmtpSettingsService {
  private readonly logger = new Logger(SmtpSettingsService.name);

  constructor(
    private readonly applicationSettings: ApplicationSettingsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  /** `workspaceId` is the workspace of the request: the row and its audit rows go there. */
  async save(user: User, body: SaveSmtpSettingsBody, workspaceId: string) {
    const { currentPassword, ...settings } = body;
    if (!(await this.passwordMatches(user.id, currentPassword))) {
      await this.record(user, workspaceId, 'refused', settings);
      throw new ForbiddenException(appError('AUTH_CURRENT_PASSWORD_INCORRECT'));
    }
    const status = await this.applicationSettings.saveSmtpSettings(user, settings, workspaceId);
    await this.record(user, workspaceId, 'saved', status.settings);
    return status;
  }

  /** Needs no password: without workspace settings, mail goes through the instance's SMTP_*. */
  async remove(user: User, workspaceId: string) {
    // Only for the audit row: a row that no longer decrypts must still be removable.
    const before = await this.applicationSettings
      .getSmtpStatus(user, workspaceId)
      .catch(() => null);
    const result = await this.applicationSettings.disconnect(
      user,
      WorkspaceServiceSettingsKey.SMTP,
      workspaceId,
    );
    const removed = before?.source === 'workspace' ? before.settings : NO_SERVER;
    await this.record(user, workspaceId, 'removed', removed);
    return result;
  }

  /** Like the other current-password checks; an account without a hash never matches. */
  private async passwordMatches(userId: string, password: string): Promise<boolean> {
    const account = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    return account?.passwordHash ? bcrypt.compare(password, account.passwordHash) : false;
  }

  private record(
    user: User,
    workspaceId: string,
    smtp: 'saved' | 'removed' | 'refused',
    { host, port, from }: SmtpAuditFields,
  ) {
    return recordSecurityEvent(this.auditService, this.logger, {
      workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: smtp === 'removed' ? AuditAction.DELETE : AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: { smtp, host: host ?? null, port: port ?? null, from: from ?? null },
    });
  }
}
