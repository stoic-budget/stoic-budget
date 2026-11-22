import type { Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { UserIdentity } from '../../entities/user-identity.entity';
import type { AuditService } from '../audit/audit.service';
import { unlinkAllIdentities } from '../auth/oidc/unlink-all-identities';
import { recordSecurityEvent } from '../auth/security-audit.util';

/**
 * What a password change shuts out besides the sessions: every linked provider
 * account, since one may have been linked by whoever knew the old password.
 * Each unlink is audited, then the change itself.
 */
export async function recordPasswordChanged(
  manager: EntityManager,
  auditService: AuditService,
  logger: Logger,
  user: { id: string; workspaceId: string | null },
): Promise<void> {
  const identities = manager.getRepository(UserIdentity);
  const unlinked = await unlinkAllIdentities(identities, auditService, logger, user);
  await recordSecurityEvent(auditService, logger, {
    workspaceId: user.workspaceId,
    actorId: user.id,
    entityType: EntityType.USER,
    entityId: user.id,
    action: AuditAction.UPDATE,
    severity: Severity.WARN,
    meta: { password: 'changed', ...(unlinked > 0 ? { singleSignOn: 'all-unlinked' } : {}) },
  });
}
