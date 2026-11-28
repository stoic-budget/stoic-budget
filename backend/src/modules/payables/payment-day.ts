import type { EntityManager } from 'typeorm';

/**
 * The day a payment was made: the one given, else the day of the bank row it
 * stands on (the bank paid then, whenever it was matched), else today. The
 * bill's `paid_at` follows it, so a bill the bank paid on time stays on time.
 */
export async function paymentDayOf(
  manager: EntityManager,
  workspaceId: string,
  given: string | null | undefined,
  transactionId: string | null,
): Promise<string> {
  if (given) return given;
  if (transactionId) {
    const [row]: Array<{ day: string }> = await manager.query(
      `SELECT "transaction_date"::date::text AS "day" FROM "transactions"
        WHERE "id" = $1 AND "workspace_id" = $2`,
      [transactionId, workspaceId],
    );
    if (row?.day) return row.day;
  }
  return new Date().toISOString().slice(0, 10);
}
