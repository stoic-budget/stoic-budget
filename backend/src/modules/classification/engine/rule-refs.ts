import type { EntityManager } from 'typeorm';
import { workspaceOwnsRefs } from '../../../common/utils/workspace-refs.util';
import type { Transaction } from '../../../entities/transaction.entity';
import type { ClassificationRule } from '../interfaces/classification-rule.interface';
import { matchingRules } from './rule-layers';

/**
 * The rules that match the row and name only this workspace's category, branch
 * and wallet, best first. A rule saved before its targets were checked may
 * still name another workspace's: it is passed over whole, not applied.
 */
export async function applicableRules(
  manager: EntityManager,
  workspaceId: string | null,
  rules: readonly ClassificationRule[],
  transaction: Transaction,
): Promise<ClassificationRule[]> {
  const applicable: ClassificationRule[] = [];
  // Best first whatever order the caller holds them in; equal priorities keep theirs.
  const ranked = [...rules].sort((a, b) => b.priority - a.priority);
  for (const rule of matchingRules(ranked, transaction)) {
    if (!workspaceId || (await workspaceOwnsRefs(manager, workspaceId, rule.result))) {
      applicable.push(rule);
    }
  }
  return applicable;
}
