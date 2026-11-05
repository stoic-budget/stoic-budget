import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import type { Transaction } from '../../../entities/transaction.entity';
import type {
  ClassificationCondition,
  ClassificationResult,
} from '../interfaces/classification-rule.interface';
import { hasDecidedCategory } from './category-decision';
import { matchesRule } from './rule-conditions';
import { decides, type LayeredField } from './rule-layers';

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
 */
export function planRuleApply(
  rows: readonly Transaction[],
  rule: { conditions: ClassificationCondition[] },
  input: {
    /** The active rules ranked above this one: what they set on a row, this one does not. */
    above?: ReadonlyArray<{ conditions: ClassificationCondition[]; result: ClassificationResult }>;
    viewerMemberId: string | null;
    setsCategory: boolean;
    setsTags: boolean;
    walletId?: string;
  },
): RuleApplyPlan {
  const matches = rows.filter(
    row => canReadPrivate(row, input.viewerMemberId) && matchesRule(row, rule),
  );
  const wins = (row: Transaction, field: LayeredField) =>
    !(input.above ?? []).some(higher => decides(higher.result, field) && matchesRule(row, higher));
  return {
    matches,
    refiled: input.setsCategory
      ? matches.filter(
          row => !(hasDecidedCategory(row) || row.taxLocked) && wins(row, 'categoryId'),
        )
      : [],
    tagged: input.setsTags ? matches : [],
    moved: matches.filter(row => movesToWallet(row, input.walletId) && wins(row, 'walletId')),
  };
}
