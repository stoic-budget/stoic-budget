import type { Repository } from 'typeorm';
import { appDefaultCurrency } from '../../common/utils/currency.util';
import { WorkspaceRole } from '../../entities';
import type { User } from '../../entities/user.entity';
import { type Workspace, WorkspaceKind } from '../../entities/workspace.entity';
import type { WorkspaceMember } from '../../entities/workspace-member.entity';
import { startingBackground } from './backup-background';

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const objectOrNull = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** The new workspace a restore builds from the snapshot's workspace row. */
export function restoredWorkspace(
  source: Record<string, unknown>,
  user: Pick<User, 'id'>,
  options: { name: string; kind?: WorkspaceKind; versionId?: string },
): Partial<Workspace> {
  return {
    name: options.name,
    kind: options.kind ?? WorkspaceKind.STANDARD,
    versionId: options.versionId ?? null,
    // Older snapshots carry none of these; the defaults then apply.
    ...(typeof source.ledgerBaseCurrency === 'string'
      ? { ledgerBaseCurrency: source.ledgerBaseCurrency }
      : {}),
    ...(typeof source.taxJurisdictionId === 'string'
      ? { taxJurisdictionId: source.taxJurisdictionId }
      : {}),
    ...(typeof source.vatStatus === 'string'
      ? { vatStatus: source.vatStatus as Workspace['vatStatus'] }
      : {}),
    description: stringOrNull(source.description),
    icon: stringOrNull(source.icon),
    color: stringOrNull(source.color),
    // A built-in background as it is; a carried picture is staged with the files.
    backgroundImage: startingBackground(source.backgroundImage),
    // The photo's credit, which it may not be shown without.
    backgroundAttribution: stringOrNull(source.backgroundAttribution),
    backgroundSourceUrl: stringOrNull(source.backgroundSourceUrl),
    // The column is required; a backup taken before that falls back the same
    // way the RequireWorkspaceCurrency migration backfilled missing ones.
    currency: stringOrNull(source.currency) ?? appDefaultCurrency(),
    settings: objectOrNull(source.settings),
    ownerId: user.id,
    isFavorite: false,
  };
}

/**
 * The restorer's owner membership. An archive leaves members out, so a row's
 * link to the member who owns it is cut, and a private row with no owner is
 * readable by nobody. When the archive's owner is the person restoring, their
 * member id in it is answered (old, new): their own private rows stay theirs.
 * Other members' rows are never handed to the restorer (#640).
 */
export async function restoreOwnerMembership(
  members: Repository<WorkspaceMember>,
  workspaceId: string,
  user: Pick<User, 'id'>,
  source: Record<string, unknown>,
): Promise<Array<[string, string]>> {
  const member = await members.save(
    members.create({
      workspaceId,
      userId: user.id,
      role: WorkspaceRole.OWNER,
      permissions: null,
      invitedById: user.id,
    }),
  );
  const own = source.ownerMemberId;
  return source.ownerId === user.id && typeof own === 'string' ? [[own, member.id]] : [];
}
