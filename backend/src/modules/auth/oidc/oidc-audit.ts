import type { Logger } from '@nestjs/common';
import type { ErrorCode } from '../../../common/errors/app-error';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import type { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../security-audit.util';

export type OidcEvent = 'sign_in' | 'account_created' | 'linked' | 'unlinked' | 'refused';

const ACTIONS: Record<OidcEvent, AuditAction> = {
  sign_in: AuditAction.UPDATE,
  account_created: AuditAction.CREATE,
  linked: AuditAction.LINK,
  unlinked: AuditAction.UNLINK,
  refused: AuditAction.UPDATE,
};

/**
 * A single sign-on event in the user's security log. Only the issuer, our
 * own refusal code and ids go in: never a token, code, state or nonce.
 * A refusal nobody can be named for (a forged or expired state) has no
 * workspace to land in, so it is a warning in the server log instead.
 */
export async function recordOidcEvent(
  auditService: AuditService,
  logger: Logger,
  event: OidcEvent,
  details: {
    user: { id: string; workspaceId: string | null } | null;
    issuer?: string | null;
    reason?: ErrorCode;
    identityId?: string;
  },
): Promise<void> {
  if (!details.user) {
    logger.warn(`Single sign-on ${event}: ${details.reason ?? 'no reason'}`);
    return;
  }
  await recordSecurityEvent(auditService, logger, {
    workspaceId: details.user.workspaceId,
    actorId: details.user.id,
    entityType: EntityType.USER,
    entityId: details.user.id,
    action: ACTIONS[event],
    severity: event === 'refused' || event === 'unlinked' ? Severity.WARN : Severity.INFO,
    meta: {
      oidcEvent: event,
      ...(details.issuer ? { provider: details.issuer } : {}),
      ...(details.reason ? { reason: details.reason } : {}),
      ...(details.identityId ? { identityId: details.identityId } : {}),
    },
  });
}
