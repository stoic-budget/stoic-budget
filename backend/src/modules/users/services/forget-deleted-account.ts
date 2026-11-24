import type { EntityManager } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { UserIdentity } from '../../../entities/user-identity.entity';

/**
 * A deleted account keeps its row (workspaces, audit trail and authorship
 * still point at it) but not the person (#642): the address, name and
 * contact details are replaced, so the same e-mail or single sign-on login
 * can register again instead of hitting the unique index with a 500.
 */
export async function forgetDeletedAccount(manager: EntityManager, userId: string): Promise<void> {
  await manager.transaction(async tx => {
    await tx.delete(UserIdentity, { userId });
    await tx.update(User, userId, {
      email: `deleted-${userId}@deleted.invalid`,
      name: 'Deleted user',
      // No hash compares equal to it: the account cannot be signed into.
      passwordHash: '',
      company: null,
      avatarUrl: null,
      telegramId: null,
      telegramChatId: null,
      telegramWorkspaceId: null,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
    });
    await tx.softDelete(User, userId);
  });
}
