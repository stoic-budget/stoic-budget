import type { EntityManager } from 'typeorm';
import type { Subscription } from '../../entities/subscription.entity';

/** Drops the rule of the row's payee once no payment of the subscription is a row of that payee. */
export async function forgetPayeeRule(
  manager: EntityManager,
  subscription: Subscription,
  transactionId: string,
): Promise<void> {
  await manager.query(
    `DELETE FROM subscription_payees rule
      WHERE rule.workspace_id = $1
        AND rule.subscription_id = $2
        AND rule.payee_id = (SELECT payee_id FROM transactions WHERE id = $3 AND workspace_id = $1)
        AND NOT EXISTS (
          SELECT 1 FROM subscription_charges charge
          JOIN transactions tx ON tx.id = charge.transaction_id AND tx.workspace_id = charge.workspace_id
          WHERE charge.subscription_id = rule.subscription_id
            AND charge.workspace_id = rule.workspace_id
            AND tx.payee_id = rule.payee_id
        )`,
    [subscription.workspaceId, subscription.id, transactionId],
  );
}

/**
 * For a query builder over transactions aliased `tx`, with `:subscriptionId`
 * and `:workspaceId` bound: rows not refused as that subscription's payment.
 */
export const NOT_REJECTED_FOR_SUBSCRIPTION = `NOT EXISTS (
  SELECT 1 FROM subscription_match_rejections rejected
   WHERE rejected.subscription_id = :subscriptionId
     AND rejected.workspace_id = :workspaceId
     AND rejected.transaction_id = tx.id)`;

/** The bank rows refused ("not this payment") as payments of this subscription. */
export async function rejectedRows(
  manager: EntityManager,
  subscription: Pick<Subscription, 'id' | 'workspaceId'>,
): Promise<Set<string>> {
  const rows: Array<{ transaction_id: string }> = await manager.query(
    `SELECT transaction_id FROM subscription_match_rejections
      WHERE subscription_id = $1 AND workspace_id = $2`,
    [subscription.id, subscription.workspaceId],
  );
  return new Set(rows.map(row => row.transaction_id));
}
