import type { EntityManager } from 'typeorm';
import { payeeKeyOf } from '../../../common/utils/payee-key.util';
import { workspaceOwnsAll, workspaceOwnsRefs } from '../../../common/utils/workspace-refs.util';
import { Payee } from '../../../entities/payee.entity';
import { PayeeAlias } from '../../../entities/payee-alias.entity';
import type { Transaction } from '../../../entities/transaction.entity';
import type {
  ClassificationResult,
  ClassificationRule,
} from '../interfaces/classification-rule.interface';
import { conditionsUse } from './rule-condition-tree';
import { matchesRule } from './rule-conditions';
import { layOver, passStartState } from './rule-row-state';
import { rowTagIds } from './rule-tags';

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
 * The tags of a saved row, read when a rule asks about tags and the caller did
 * not load them; undefined leaves the row's relation (or none, for a row being
 * imported).
 */
async function storedTagIds(
  manager: EntityManager,
  workspaceId: string | null,
  rules: readonly ClassificationRule[],
  transaction: Transaction,
): Promise<string[] | undefined> {
  if (transaction.tags || !transaction.id || !workspaceId || !conditionsUse(rules, 'tags')) {
    return undefined;
  }
  return (await rowTagIds(manager, workspaceId, [transaction.id])).get(transaction.id) ?? [];
}

/**
 * The row with the payee it will be given on save when it has none yet: a row
 * being imported gets its payee from the alias of its descriptor only as it is
 * inserted, after the rules ran. Looked up only when a rule asks about the payee.
 */
async function withArrivingPayee(
  manager: EntityManager,
  workspaceId: string | null,
  rules: readonly ClassificationRule[],
  transaction: Transaction,
): Promise<Transaction> {
  const payeeKey = payeeKeyOf(transaction);
  if (transaction.payeeId || !workspaceId || !payeeKey || !conditionsUse(rules, 'payee')) {
    return transaction;
  }
  const alias = await manager
    .getRepository(PayeeAlias)
    .findOne({ where: { workspaceId, payeeKey } });
  return alias ? ({ ...transaction, payeeId: alias.payeeId } as Transaction) : transaction;
}

/**
 * The rules that match the row and name only what is this workspace's, best
 * first. A rule saved before its targets were checked may still name another
 * workspace's: it is passed over whole, not applied, and sets nothing the
 * rules below it see. Each rule sees the row as it arrived (passStartState)
 * with what the ones above set on it (rule-row-state).
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
  const tagIds = await storedTagIds(manager, workspaceId, ranked, transaction);
  const arrived = await withArrivingPayee(manager, workspaceId, ranked, transaction);
  let state = passStartState(arrived, ranked, tagIds);
  for (const rule of ranked) {
    if (!matchesRule(transaction, rule, state)) {
      continue;
    }
    if (!workspaceId || (await ownsRuleRefs(manager, workspaceId, rule.result))) {
      applicable.push(rule);
      state = layOver(state, rule, transaction);
    }
  }
  return applicable;
}
