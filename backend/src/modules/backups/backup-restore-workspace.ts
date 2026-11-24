import { appDefaultCurrency } from '../../common/utils/currency.util';
import type { User } from '../../entities/user.entity';
import { type Workspace, WorkspaceKind } from '../../entities/workspace.entity';
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
