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
