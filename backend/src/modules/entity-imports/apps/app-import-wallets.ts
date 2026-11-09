import type { EntityManager } from 'typeorm';
import { Wallet } from '../../../entities/wallet.entity';
import { APP_IMPORT_TARGET } from '../helpers/import-undo';
import type { ExistingWallet } from './app-plan-accounts';

/**
 * The workspace's accounts. One an app import created (and was not undone)
 * that still opens at zero takes the opening balance its own export brings:
 * it was created as the other side of a transfer, before that export.
 */
export async function existingWallets(
  manager: EntityManager,
  workspaceId: string,
): Promise<ExistingWallet[]> {
  const wallets = await manager.getRepository(Wallet).find({
    where: { workspaceId },
    select: { id: true, name: true, currency: true, ownerMemberId: true, initialBalance: true },
  });
  const imported: Array<{ id: string }> = await manager.query(
    `SELECT DISTINCT ref->>'id' AS id
       FROM import_batches b CROSS JOIN LATERAL jsonb_array_elements(b.created_refs) ref
      WHERE b.workspace_id = $1 AND b.target = $2 AND b.undone_at IS NULL
        AND ref->>'kind' = 'wallet'`,
    [workspaceId, APP_IMPORT_TARGET],
  );
  const created = new Set(imported.map(row => row.id));
  return wallets.map(wallet => ({
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    ownerMemberId: wallet.ownerMemberId,
    takesOpening: created.has(wallet.id) && Number(wallet.initialBalance) === 0,
  }));
}
