import type { EntityManager } from 'typeorm';
import type { RuleConditionNode } from '../interfaces/classification-rule.interface';
import { replaceConditionRefs } from './rule-condition-tree';

/**
 * Rules that ask about a payee folded into `targetId` ask about the target from
 * then on: the merged payee's id is gone, and a condition naming it would never
 * hold again (or, negated, always).
 */
export async function movePayeeConditionsInto(
  manager: EntityManager,
  workspaceId: string,
  targetId: string,
  sourceIds: readonly string[],
): Promise<void> {
  const rules: Array<{ id: string; conditions: RuleConditionNode[] }> = await manager.query(
    `SELECT id, conditions FROM categorization_rules
      WHERE workspace_id = $1 AND conditions::text LIKE ANY($2::text[])`,
    [workspaceId, sourceIds.map(id => `%"${id}"%`)],
  );
  const from = new Set(sourceIds);
  for (const rule of rules) {
    const conditions = replaceConditionRefs(rule.conditions, 'payee', from, targetId);
    await manager.query(
      'UPDATE categorization_rules SET conditions = $1::jsonb WHERE workspace_id = $2 AND id = $3',
      [JSON.stringify(conditions), workspaceId, rule.id],
    );
  }
}
