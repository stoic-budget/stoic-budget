import type { User } from '../../entities/user.entity';

/** The fields UpdateUserDto can change — nothing credential-bearing. */
export function snapshotAdminFields(user: User) {
  return {
    email: user.email,
    name: user.name,
    company: user.company,
    role: user.role,
    isActive: user.isActive,
    permissions: user.permissions ?? null,
  };
}

/** The admin removal forgets the person as self-service deletion does (#642). */
export { forgetDeletedAccount } from './services/forget-deleted-account';
