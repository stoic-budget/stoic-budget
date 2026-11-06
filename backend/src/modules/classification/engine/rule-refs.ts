import type { EntityManager } from 'typeorm';
import { workspaceOwnsAll, workspaceOwnsRefs } from '../../../common/utils/workspace-refs.util';
import { Payee } from '../../../entities/payee.entity';
import type { Transaction } from '../../../entities/transaction.entity';
import type {
  ClassificationResult,
  ClassificationRule,
} from '../interfaces/classification-rule.interface';
import { matchingRules } from './rule-layers';

/**
 * Whether every category, branch, wallet and payee the rule sets is this
 * workspace's and still there. Checked when a rule is used, not only when it
 * is saved: a row pointing at a missing payee would fail on its foreign key.
 */
export async function ownsRuleRefs(
  manager: EntityManager,
  workspaceId: string,
  result: ClassificationResult,
): Promise<boolean> {
  const [refs, payee] = await Promise.all([
    workspaceOwnsRefs(manager, workspaceId, result),
    workspaceOwnsAll(manager, Payee, [result.payeeId], workspaceId),
  ]);
  return refs && payee;
}

/**
 * The rules that match the row and name only what is this workspace's, best
 * first. A rule saved before its targets were checked may still name another
 * workspace's: it is passed over whole, not applied.
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
    if (!workspaceId || (await ownsRuleRefs(manager, workspaceId, rule.result))) {
      applicable.push(rule);
    }
  }
  return applicable;
}
