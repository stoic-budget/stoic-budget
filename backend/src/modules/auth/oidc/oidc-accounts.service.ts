import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, QueryFailedError, type Repository } from 'typeorm';
import type { ErrorCode } from '../../../common/errors/app-error';
import { hashPassword } from '../../../common/utils/password-hash.util';
import { User, UserIdentity, UserRole, WorkspaceMember } from '../../../entities';
import { AuditService } from '../../audit/audit.service';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';
import { recordOidcEvent } from './oidc-audit';
import type { IdTokenClaims } from './oidc-id-token';
import { OidcRefusal } from './oidc-refusal';
import type { OidcConfig } from './oidc-settings.service';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error as { code?: string }).code === '23505';

/**
 * Who a verified provider account is. Only a linked identity signs someone
 * in: an e-mail that matches an existing user is never linked on its own,
 * because whoever controls that address at the provider would then own the
 * account here.
 */
@Injectable()
export class OidcAccountsService {
  private readonly logger = new Logger(OidcAccountsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserIdentity) private readonly identities: Repository<UserIdentity>,
    private readonly registration: RegistrationSettingsService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  /** The user a sign-in opens: linked, or new when every rule allows one. */
  async signIn(
    claims: IdTokenClaims,
    config: OidcConfig,
  ): Promise<{ user: User; identityId: string }> {
    const issuer = config.issuer;
    const linked = await this.identities.findOne({ where: { issuer, subject: claims.subject } });
    if (linked) {
      const user = await this.users.findOne({ where: { id: linked.userId } });
      if (!user?.isActive) {
        await this.refuse(user, issuer, 'AUTH_ACCOUNT_INACTIVE', HttpStatus.UNAUTHORIZED);
      }
      await this.ensureWorkspace(user as User);
      return { user: user as User, identityId: linked.id };
    }

    if (!(claims.email && claims.emailVerified)) {
      await this.refuse(null, issuer, 'OIDC_EMAIL_NOT_VERIFIED');
    }
    const email = claims.email as string;
    const owner = await this.findByEmail(email);
    if (owner) await this.refuse(owner, issuer, 'OIDC_ACCOUNT_EXISTS', HttpStatus.CONFLICT);
    if (!(config.allowSignup && (await this.registration.isOpen()))) {
      await this.refuse(null, issuer, 'OIDC_SIGNUP_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    }
    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (config.allowedDomains.length > 0 && !config.allowedDomains.includes(domain)) {
      await this.refuse(null, issuer, 'OIDC_DOMAIN_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    }
    return this.createAccount(claims, email, issuer);
  }

  /** Links a provider account to a signed-in user who started the link themselves. */
  async link(userId: string, claims: IdTokenClaims, issuer: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user?.isActive)
      await this.refuse(user, issuer, 'AUTH_ACCOUNT_INACTIVE', HttpStatus.UNAUTHORIZED);
    const existing = await this.identities.findOne({ where: { issuer, subject: claims.subject } });
    if (existing?.userId === userId) return;
    if (existing)
      await this.refuse(user, issuer, 'OIDC_IDENTITY_LINKED_ELSEWHERE', HttpStatus.CONFLICT);
    try {
      const saved = await this.identities.save(
        this.identities.create({ userId, issuer, subject: claims.subject, email: claims.email }),
      );
      await recordOidcEvent(this.auditService, this.logger, 'linked', {
        user,
        issuer,
        identityId: saved.id,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another request linked it a moment earlier: to this user, or to someone else.
      const winner = await this.identities.findOne({ where: { issuer, subject: claims.subject } });
      if (winner?.userId !== userId) {
        await this.refuse(user, issuer, 'OIDC_IDENTITY_LINKED_ELSEWHERE', HttpStatus.CONFLICT);
      }
    }
  }

  /**
   * One transaction under a lock on the provider account, so two sign-ins
   * racing for the same new person make one user, not two. The password is
   * random and unknown: `passwordSet` false keeps the last identity linked
   * until the owner sets their own with a reset.
   */
  private async createAccount(
    claims: IdTokenClaims,
    email: string,
    issuer: string,
  ): Promise<{ user: User; identityId: string }> {
    const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
    let created: { user: User; identityId: string; isNew: boolean };
    try {
      created = await this.dataSource.transaction(async manager => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `oidc:${issuer}:${claims.subject}`,
        ]);
        const raced = await manager.findOne(UserIdentity, {
          where: { issuer, subject: claims.subject },
        });
        if (raced) {
          const user = await manager.findOneOrFail(User, { where: { id: raced.userId } });
          return { user, identityId: raced.id, isNew: false };
        }
        const user = await manager.save(
          manager.create(User, {
            email,
            passwordHash,
            passwordSet: false,
            name: claims.name || email.slice(0, email.indexOf('@')),
            role: UserRole.USER,
            isActive: true,
            permissions: null,
          }),
        );
        const identity = await manager.save(
          manager.create(UserIdentity, { userId: user.id, issuer, subject: claims.subject, email }),
        );
        return { user, identityId: identity.id, isNew: true };
      });
    } catch (error) {
      // Someone took the address between the check and the insert.
      if (isUniqueViolation(error))
        await this.refuse(null, issuer, 'OIDC_ACCOUNT_EXISTS', HttpStatus.CONFLICT);
      throw error;
    }
    await this.ensureWorkspace(created.user);
    if (created.isNew) {
      await recordOidcEvent(this.auditService, this.logger, 'account_created', {
        user: created.user,
        issuer,
        identityId: created.identityId,
      });
    }
    return { user: created.user, identityId: created.identityId };
  }

  /**
   * The workspace of an account made here. It is created after the user and
   * identity are committed, so a failure there would leave a linked account
   * with none; the next sign-in finishes it. Only accounts made by single
   * sign-on (no password set) that belong to no workspace at all qualify.
   * A sign-in that finds another one already making it goes on without.
   */
  private async ensureWorkspace(user: User): Promise<void> {
    if (user.passwordSet || user.workspaceId) return;
    await this.dataSource.transaction(async manager => {
      const [{ locked }] = await manager.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',
        [`oidc-workspace:${user.id}`],
      );
      if (!locked) return;
      const fresh = await manager.findOne(User, { where: { id: user.id } });
      if (fresh?.workspaceId) user.workspaceId = fresh.workspaceId;
      if (!fresh || fresh.workspaceId) return;
      if ((await manager.count(WorkspaceMember, { where: { userId: user.id } })) > 0) return;
      await this.authService.createOwnedWorkspaceForUser(fresh, `${fresh.name} workspace`);
      user.workspaceId = fresh.workspaceId;
    });
  }

  private findByEmail(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();
  }

  private async refuse(
    user: User | null,
    issuer: string,
    reason: ErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ): Promise<never> {
    await recordOidcEvent(this.auditService, this.logger, 'refused', { user, issuer, reason });
    throw new OidcRefusal(reason, status);
  }
}
