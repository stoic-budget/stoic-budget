import { Exit, Schema } from 'effect';
import { type PropertyKind, RealEstateAttributes, VehicleAttributes } from '../../../contracts';
import { type BalanceAccount, BalanceAccountType } from '../../../entities';

/** The household sections whose lines are things someone owns, and what kind each is. */
const KIND_BY_SECTION: Record<string, PropertyKind> = {
  ASSET_REAL_ESTATE: 'real_estate',
  ASSET_VEHICLES: 'vehicle',
};

/**
 * The kind of a balance line, or null when it is not a property: an asset
 * leaf (a line that holds its own value) in the real estate or vehicles
 * section, or that section itself while it has no lines under it.
 */
export function propertyKindOf(
  account: BalanceAccount,
  accounts: readonly BalanceAccount[],
): PropertyKind | null {
  if (account.accountType !== BalanceAccountType.ASSET || account.isAutoComputed) return null;
  if (accounts.some(other => other.parentId === account.id)) return null;
  const byId = new Map(accounts.map(item => [item.id, item]));
  let root = account;
  const seen = new Set<string>();
  while (root.parentId && !seen.has(root.id)) {
    seen.add(root.id);
    const parent = byId.get(root.parentId);
    if (!parent) break;
    root = parent;
  }
  return KIND_BY_SECTION[root.code] ?? null;
}

type Decoder = (value: unknown) => Exit.Exit<Record<string, unknown>, unknown>;

const decoders: Record<PropertyKind, Decoder> = {
  real_estate: Schema.decodeUnknownExit(RealEstateAttributes, { onExcessProperty: 'error' }),
  vehicle: Schema.decodeUnknownExit(VehicleAttributes, { onExcessProperty: 'error' }),
};

/**
 * The attributes as they are stored for a line of `kind`: null for nothing
 * filled in, undefined when they are not this kind's (a car's make on a flat).
 */
export function attributesFor(
  kind: PropertyKind,
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value === null || value === undefined) return null;
  const exit = decoders[kind](value);
  if (Exit.isFailure(exit)) return undefined;
  const kept = Object.fromEntries(
    Object.entries(exit.value).filter(([, item]) => item !== undefined),
  );
  return Object.keys(kept).length > 0 ? kept : null;
}
