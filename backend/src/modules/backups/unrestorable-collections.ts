/**
 * Collections that backups made before they were excluded still carry, and
 * that cannot come back: people and per-member rows rather than workspace
 * data (the restore makes its own owner membership, and every member's row
 * would land on the restorer), and share links whose required token the
 * backup stripped.
 */
export const UNRESTORABLE_COLLECTIONS = new Set([
  'custom_table_shares',
  // Derived and regenerated; its dedup key is unique per user, so a copy of
  // the same user's live insights would collide.
  'insights',
  'users',
  // A member's own view settings: every member's would land on the restorer and collide.
  'view_preferences',
  'workspace_invitations',
  'workspace_members',
]);
