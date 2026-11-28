import type { EntityManager } from 'typeorm';

/**
 * The rows to delete with these: the other leg of each transfer the app booked
 * when a loan's bill was paid from an account. Deleted alone, the leg left on
 * the loan account would keep the debt one payment lower than it is.
 */
export async function withLoanPaymentLegs(
  manager: EntityManager,
  workspaceId: string,
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [...ids];
  const legs: Array<{ id: string }> = await manager.query(
    `SELECT DISTINCT leg."id"
       FROM "transactions" t
       JOIN "transactions" leg
         ON leg."transfer_pair_id" = t."transfer_pair_id"
        AND leg."workspace_id" = t."workspace_id" AND leg."id" <> t."id"
      WHERE t."workspace_id" = $1 AND t."id" = ANY($2::uuid[])
        AND t."transfer_pair_id" IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "payable_payments" pp
            JOIN "payables" p ON p."id" = pp."payable_id" AND p."workspace_id" = pp."workspace_id"
           WHERE pp."workspace_id" = $1 AND pp."own_transaction"
             AND p."loan_wallet_id" IS NOT NULL
             AND pp."transaction_id" IN (t."id", leg."id"))`,
    [workspaceId, ids],
  );
  return [...new Set([...ids, ...legs.map(leg => leg.id)])];
}
