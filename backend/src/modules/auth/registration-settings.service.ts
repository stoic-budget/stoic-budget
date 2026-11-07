import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { InstanceSetting, InstanceSettingKey, User } from '../../entities';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from './security-audit.util';

/**
 * Whether someone without an invitation can create an account. What an
 * administrator chose wins; until then `REGISTRATION_ENABLED` decides, and it
 * defaults to open so a server that was open stays open.
 */
@Injectable()
export class RegistrationSettingsService {
  private readonly logger = new Logger(RegistrationSettingsService.name);

  constructor(
    @InjectRepository(InstanceSetting)
    private readonly instanceSettingsRepository: Repository<InstanceSetting>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  /** Always true for the first account, or a new server could never get an owner. */
  async isOpen(): Promise<boolean> {
    if (await this.isConfiguredOpen()) return true;
    return (await this.userRepository.count()) === 0;
  }

  async setOpen(user: User, open: boolean): Promise<void> {
    const before = await this.isConfiguredOpen();
    const existing = await this.instanceSettingsRepository.findOne({
      where: { key: InstanceSettingKey.REGISTRATION },
    });
    await this.instanceSettingsRepository.save(
      this.instanceSettingsRepository.create({
        ...existing,
        key: InstanceSettingKey.REGISTRATION,
        value: { open },
        updatedByUserId: user.id,
      }),
    );
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      diff: { before: { registrationOpen: before }, after: { registrationOpen: open } },
      meta: { registrationOpen: open },
    });
  }

  private async isConfiguredOpen(): Promise<boolean> {
    const saved = await this.instanceSettingsRepository.findOne({
      where: { key: InstanceSettingKey.REGISTRATION },
    });
    const open = saved?.value?.open;
    return typeof open === 'boolean' ? open : process.env.REGISTRATION_ENABLED !== 'false';
  }
}
