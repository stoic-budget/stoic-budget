import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import type { Transaction } from '../../../entities/transaction.entity';
import type {
  ClassificationResult,
  MatchMode,
  RuleConditionNode,
} from '../interfaces/classification-rule.interface';
import { hasDecidedCategory } from './category-decision';
import { matchesRule } from './rule-conditions';
import { decides, type LayeredField, passRules } from './rule-layers';
import { hasNoComment, pickedByHand } from './rule-result';
import { type RuleRowState, storedState } from './rule-row-state';

/** A rule as an apply or a preview tries it. */
type TriedRule = {
  name?: string;
  conditions: RuleConditionNode[];
  matchMode?: MatchMode;
  result: ClassificationResult;
};

/**
 * The rule's matches among rows the caller may read, each with the rules
 * above it that match it too. Rules add up best first, so a condition on the
 * category, payee, tags or comment reads the row as those rules above left it
 * (rule-row-state). `tagIds` holds the rows' tags, by row id, when a rule asks about them.
 */
export function rowsMatching<Above extends TriedRule>(
  rows: readonly Transaction[],
  rule: Omit<TriedRule, 'result'>,
  input: {
    above?: readonly Above[];
    viewerMemberId: string | null;
    tagIds?: ReadonlyMap<string, readonly string[]>;
  },
): Array<{ row: Transaction; above: Above[]; state: RuleRowState }> {
  return rows.flatMap(row => {
    if (!canReadPrivate(row, input.viewerMemberId)) {
      return [];
    }
    // A row missing from a loaded map has no tags; without a map, its relation counts.
    const start = storedState(row, input.tagIds ? (input.tagIds.get(row.id) ?? []) : undefined);
    const pass = passRules(input.above ?? [], row, start);
    return matchesRule(row, rule, pass.state)
      ? [{ row, above: pass.matching, state: pass.state }]
      : [];
  });
}

/** What applying a rule changes among a page of existing rows. */
export interface RuleApplyPlan {
  /** Rows the caller may read that the rule matches. */
  matches: Transaction[];
  /** Matches that take the rule's category. */
  refiled: Transaction[];
  /** Matches that get the rule's tags. */
  tagged: Transaction[];
  /** Matches that move to the rule's account. */
  moved: Transaction[];
  /** Matches with no comment yet, which take the rule's. */
  commented: Transaction[];
  /** Matches that take the rule's payee: not theirs already, not picked by a person. */
  renamed: Transaction[];
}

/**
 * Whether applying a rule that names `walletId` moves the row there. A leg of
 * a transfer stays: its place is what makes the pair a transfer.
 */
export function movesToWallet(
  row: Pick<Transaction, 'walletId' | 'transferPairId'>,
  walletId: string | null | undefined,
): boolean {
  return Boolean(walletId) && row.walletId !== walletId && !row.transferPairId;
}

/**
 * The category goes only on rows nobody decided: a category picked by hand, or
 * put there by a rule, stays, and so does one on a filed tax return. Tags go on
 * every match, since adding one takes nothing away. Another member's private
 * row is not a match at all. A rule that names an account moves its matches
 * there: the user asked for it knowing the balances of both accounts change.
 * Rules add up, best first, so what a rule ranked above sets on a row is that
 * rule's to set: this one leaves the category or the account of such a row.
 * A comment goes only where there is none, and a payee never over a person's pick.
 */
export function planRuleApply(
  rows: readonly Transaction[],
  rule: Omit<TriedRule, 'result'>,
  input: {
    /** The active rules ranked above this one: what they set on a row, this one does not. */
    above?: readonly TriedRule[];
    viewerMemberId: string | null;
    /** The rows' tags by row id, when a rule asks about tags. */
    tagIds?: ReadonlyMap<string, readonly string[]>;
    setsCategory: boolean;
    setsTags: boolean;
    walletId?: string;
    comment?: string;
    payeeId?: string;
  },
): RuleApplyPlan {
  const matching = rowsMatching(rows, rule, input);
  const matches = matching.map(({ row }) => row);
  const aboveOf = new Map(matching.map(({ row, above }) => [row.id, above]));
  const wins = (row: Transaction, field: LayeredField) =>
    !(aboveOf.get(row.id) ?? []).some(higher => decides(higher.result, field));
  return {
    matches,
    refiled: input.setsCategory
      ? matches.filter(
          row => !(hasDecidedCategory(row) || row.taxLocked) && wins(row, 'categoryId'),
        )
      : [],
    tagged: input.setsTags ? matches : [],
    moved: matches.filter(row => movesToWallet(row, input.walletId) && wins(row, 'walletId')),
    commented: input.comment
      ? matches.filter(row => hasNoComment(row) && wins(row, 'comment'))
      : [],
    renamed: input.payeeId
      ? matches.filter(
          row => row.payeeId !== input.payeeId && !pickedByHand(row) && wins(row, 'payeeId'),
        )
      : [],
  };
}
