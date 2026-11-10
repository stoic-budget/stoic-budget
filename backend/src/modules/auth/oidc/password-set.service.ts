import { HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, type Repository } from 'typeorm';
import { appError, type ErrorCode } from '../../../common/errors/app-error';
import { hashPassword } from '../../../common/utils/password-hash.util';
import { AuthSession, User } from '../../../entities';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { AuditService } from '../../audit/audit.service';
import { AuthService, type SessionContext } from '../auth.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import { recordSecurityEvent } from '../security-audit.util';
import { recordOidcEvent } from './oidc-audit';
import { OidcRefusal } from './oidc-refusal';
import { OidcStepUpService } from './oidc-step-up.service';

/**
 * The first password of an account made by single sign-on. It has no password
 * to confirm, so a fresh sign-in at the provider (the step-up) stands in for
 * one. Like a password change (`UsersService.changePassword`), the token
 * version goes up, which ends every session's tokens; unlike it, this device
 * gets a new session at once, so the person carries on here and every other
 * session (a borrowed or stolen one included) is out.
 */
@Injectable()
export class PasswordSetService {
  private readonly logger = new Logger(PasswordSetService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly stepUp: OidcStepUpService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async set(
    caller: { userId: string; sessionId: string | null },
    stepUpSecret: string | undefined,
    newPassword: string,
    context: SessionContext,
  ): Promise<{ user: User; tokens: AuthResponseDto }> {
    const user = await this.users.findOne({ where: { id: caller.userId } });
    if (!user?.isActive) throw new UnauthorizedException(appError('AUTH_ACCOUNT_INACTIVE'));
    if (user.passwordSet) await this.refuse(user, 'AUTH_PASSWORD_ALREADY_SET', HttpStatus.CONFLICT);
    const grant = await this.stepUp.consume(stepUpSecret, user.id, caller.sessionId);
    if (!grant) await this.refuse(user, 'AUTH_STEP_UP_REQUIRED', HttpStatus.FORBIDDEN);

    const passwordHash = await hashPassword(newPassword);
    // Only while no password is set: of two requests with two step-ups, one wins.
    const changed = await this.dataSource.transaction(async manager => {
      const result = await manager
        .createQueryBuilder()
        .update(User)
        .set({ passwordHash, passwordSet: true, tokenVersion: () => 'token_version + 1' })
        .where('id = :id AND password_set = false', { id: user.id })
        .execute();
      if (!result.affected) return false;
      await manager.update(
        AuthSession,
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      return true;
    });
    if (!changed) await this.refuse(user, 'AUTH_PASSWORD_ALREADY_SET', HttpStatus.CONFLICT);

    const fresh = await this.users.findOneOrFail({ where: { id: user.id } });
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: fresh.workspaceId,
      actorId: fresh.id,
      entityType: EntityType.USER,
      entityId: fresh.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: {
        password: 'set',
        sessions: 'all-revoked',
        provider: grant?.issuer,
        identityId: grant?.identityId,
      },
    });
    return { user: fresh, tokens: await this.authService.generateTokens(fresh, context) };
  }

  private async refuse(user: User, reason: ErrorCode, status: HttpStatus): Promise<never> {
    await recordOidcEvent(this.auditService, this.logger, 'refused', { user, reason });
    throw new OidcRefusal(reason, status);
  }
}
