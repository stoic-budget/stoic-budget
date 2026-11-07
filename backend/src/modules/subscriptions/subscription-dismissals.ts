import type { Repository } from 'typeorm';
import type { Subscription } from '../../entities/subscription.entity';
import type { Workspace } from '../../entities/workspace.entity';

const DISMISSED_VENDORS_KEY = 'dismissedSubscriptionVendors';

/** How detection groups a vendor's charges, and so how a dismissal recognizes them. */
export function subscriptionVendorKey(name: string): string {
  return name.toLowerCase().trim();
}

export function dismissedVendorsOf(settings: Record<string, unknown> | null | undefined) {
  const stored = settings?.[DISMISSED_VENDORS_KEY];
  return new Set<string>(Array.isArray(stored) ? stored : []);
}

/**
 * "Not a subscription" has to outlive the deleted row: the charges are still
 * there, and the next detection run would find them and suggest it again.
 */
export async function rememberDismissedVendors(
  workspaces: Repository<Workspace>,
  workspaceId: string,
  subscription: Pick<Subscription, 'vendorName' | 'vendorRaw'>,
): Promise<void> {
  const workspace = await workspaces.findOne({ where: { id: workspaceId } });
  if (!workspace) return;
  const names = [subscription.vendorName, subscription.vendorRaw].flatMap(name =>
    name ? [subscriptionVendorKey(name)] : [],
  );
  const dismissed = new Set([...dismissedVendorsOf(workspace.settings), ...names]);
  await workspaces.update(workspaceId, {
    settings: { ...workspace.settings, [DISMISSED_VENDORS_KEY]: [...dismissed] },
  });
}
