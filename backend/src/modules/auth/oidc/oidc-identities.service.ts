import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, type Repository } from 'typeorm';
import type { OidcIdentityList } from '../../../contracts';
import { User, UserIdentity } from '../../../entities';
import { AuditService } from '../../audit/audit.service';
import { recordOidcEvent } from './oidc-audit';
import { OidcRefusal } from './oidc-refusal';
import { OidcSettingsService } from './oidc-settings.service';

/** The provider accounts a signed-in user sees in their security settings. */
@Injectable()
export class OidcIdentitiesService {
  private readonly logger = new Logger(OidcIdentitiesService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserIdentity) private readonly identities: Repository<UserIdentity>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly settings: OidcSettingsService,
    private readonly auditService: AuditService,
  ) {}

  async list(userId: string): Promise<OidcIdentityList> {
    const [user, rows, provider] = await Promise.all([
      this.users.findOne({ where: { id: userId }, select: { id: true, passwordSet: true } }),
      this.identities.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.settings.publicStatus(),
    ]);
    return {
      passwordSet: user?.passwordSet ?? true,
      providerEnabled: provider.enabled,
      buttonLabel: provider.buttonLabel,
      identities: rows.map(row => ({
        id: row.id,
        issuer: row.issuer,
        email: row.email,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * The current password, asked before a link starts. An account made by
   * single sign-on has a random one nobody knows, so it cannot link more
   * until its owner sets a password by reset. A wrong one is logged.
   */
  async confirmPassword(userId: string, password: string): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, workspaceId: true, passwordHash: true, isActive: true },
    });
    const valid = user?.isActive && (await bcrypt.compare(password, user.passwordHash ?? ''));
    if (valid) return;
    await recordOidcEvent(this.auditService, this.logger, 'refused', {
      user,
      reason: 'AUTH_CURRENT_PASSWORD_INCORRECT',
    });
    throw new OidcRefusal('AUTH_CURRENT_PASSWORD_INCORRECT', HttpStatus.FORBIDDEN);
  }

  /**
   * Removes one of the caller's own identities. The user row is locked so
   * two unlinks at once cannot both pass the "not the last way in" check.
   */
  async unlink(userId: string, identityId: string): Promise<OidcIdentityList> {
    const removed = await this.remove(userId, identityId).catch(async error => {
      if (error instanceof OidcRefusal && error.code === 'OIDC_LAST_SIGN_IN_METHOD') {
        const user = await this.users.findOne({ where: { id: userId } });
        await recordOidcEvent(this.auditService, this.logger, 'refused', {
          user,
          reason: error.code,
        });
      }
      throw error;
    });
    await recordOidcEvent(this.auditService, this.logger, 'unlinked', {
      user: removed.user,
      issuer: removed.identity.issuer,
      identityId: removed.identity.id,
    });
    return this.list(userId);
  }

  private remove(userId: string, identityId: string) {
    return this.dataSource.transaction(async manager => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      const identity = await manager.findOne(UserIdentity, { where: { id: identityId, userId } });
      if (!(user && identity))
        throw new OidcRefusal('OIDC_IDENTITY_NOT_FOUND', HttpStatus.NOT_FOUND);
      const count = await manager.count(UserIdentity, { where: { userId } });
      if (!user.passwordSet && count <= 1) {
        throw new OidcRefusal('OIDC_LAST_SIGN_IN_METHOD', HttpStatus.CONFLICT);
      }
      await manager.delete(UserIdentity, { id: identity.id, userId });
      return { user, identity };
    });
  }
}
