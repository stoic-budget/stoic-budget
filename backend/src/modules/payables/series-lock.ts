import type { EntityManager } from 'typeorm';

/**
 * The one lock of a repeating series, held until the transaction ends. Every
 * writer of a series' rule takes it first: making the next occurrence,
 * stopping the series, editing the rule in the bill form, and the actions on
 * one occurrence. So they run one after another and never wait on each
 * other's rows in turn (two stops on two occurrences would deadlock), and a
 * rule changed or cleared while the next occurrence is being made reaches
 * that occurrence too.
 */
export async function lockSeries(
  manager: EntityManager,
  workspaceId: string,
  seriesId: string,
): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${workspaceId}:${seriesId}`]);
}
