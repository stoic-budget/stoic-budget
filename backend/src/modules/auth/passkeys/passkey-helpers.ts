import type { Logger } from '@nestjs/common';
import type { AuthenticatorTransport } from '@simplewebauthn/server';
import type { EntityManager } from 'typeorm';
import type { Passkey } from '../../../contracts';
import { type PasskeyCredential, WorkspaceMember, WorkspaceRole } from '../../../entities';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import type { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../security-audit.util';
import { PASSKEY_CHALLENGE_TTL_MS } from './passkey-challenge.store';

export const PASSKEY_TIMEOUT_MS = PASSKEY_CHALLENGE_TTL_MS;

const TRANSPORTS = new Set<AuthenticatorTransport>(['ble', 'hybrid', 'internal', 'nfc', 'usb']);

/** The transports a browser reported, without anything WebAuthn does not define. */
export const knownTransports = (values: readonly string[] | undefined) =>
  (values ?? []).filter((value): value is AuthenticatorTransport =>
    TRANSPORTS.has(value as AuthenticatorTransport),
  );

/**
 * The WebAuthn user handle: the user's id as UTF-8 bytes, base64url. An
 * authenticator hands it back on a sign-in without an e-mail, and it must name
 * the owner of the credential that signed.
 */
export const userHandleOf = (userId: string): string =>
  Buffer.from(userId, 'utf8').toString('base64url');

export const toPasskey = (row: PasskeyCredential): Passkey => ({
  id: row.id,
  name: row.name,
  deviceType: row.deviceType,
  backedUp: row.backedUp,
  createdAt: row.createdAt.toISOString(),
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
});

export type PasskeyEvent = 'added' | 'removed' | 'counter_regression';

/**
 * The workspace a passkey event is filed in: the home workspace, or, once the
 * user deleted it, the one they own or else joined first. The audit log is read
 * per workspace only, so an event filed nowhere would be dropped.
 */
async function auditWorkspaceOf(
  manager: EntityManager,
  user: { id: string; workspaceId?: string | null },
): Promise<string | null> {
  if (user.workspaceId) {
    return user.workspaceId;
  }
  const memberships = await manager.getRepository(WorkspaceMember).find({
    where: { userId: user.id },
    select: { workspaceId: true, role: true },
    order: { createdAt: 'ASC' },
  });
  return (
    memberships.find(row => row.role === WorkspaceRole.OWNER)?.workspaceId ??
    memberships[0]?.workspaceId ??
    null
  );
}

/**
 * Only what happened and to which passkey: never the key, the challenge or the
 * name. A user in no workspace at all still leaves a trace: a server log line
 * at warn (error for a counter regression) instead of the audit row.
 */
export async function recordPasskeyEvent(
  auditService: AuditService,
  logger: Logger,
  manager: EntityManager,
  user: { id: string; workspaceId?: string | null },
  passkey: PasskeyEvent,
  passkeyId: string,
): Promise<void> {
  const workspaceId = await auditWorkspaceOf(manager, user);
  if (!workspaceId) {
    const line = `Passkey ${passkey} for user ${user.id} (passkey ${passkeyId}), no workspace to audit in`;
    if (passkey === 'counter_regression') logger.error(line);
    else logger.warn(line);
    return;
  }
  await recordSecurityEvent(auditService, logger, {
    workspaceId,
    actorId: user.id,
    entityType: EntityType.USER,
    entityId: user.id,
    action: AuditAction.UPDATE,
    severity: passkey === 'added' ? Severity.WARN : Severity.CRITICAL,
    meta: { passkey, passkeyId },
  });
}
