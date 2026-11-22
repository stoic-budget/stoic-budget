import type { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { UserIdentity } from '../../../entities/user-identity.entity';
import type { AuditService } from '../../audit/audit.service';
import { recordOidcEvent } from './oidc-audit';

/**
 * Unlinks every provider account of a user, each with its own `unlinked` event,
 * and answers how many there were. A password change calls it: a provider
 * account linked while someone else knew the password may be theirs.
 */
export async function unlinkAllIdentities(
  identities: Repository<UserIdentity>,
  auditService: AuditService,
  logger: Logger,
  user: { id: string; workspaceId: string | null },
): Promise<number> {
  const unlinked = await identities.find({ where: { userId: user.id } });
  if (unlinked.length === 0) return 0;
  await identities.delete({ userId: user.id });
  for (const identity of unlinked) {
    await recordOidcEvent(auditService, logger, 'unlinked', {
      user,
      issuer: identity.issuer,
      identityId: identity.id,
    });
  }
  return unlinked.length;
}
