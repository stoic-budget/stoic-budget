import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import type { ClassificationResult } from '../interfaces/classification-rule.interface';
import { hasNoComment, pickedByHand } from './rule-result';

/**
 * What a condition on the category, the payee, the tags or the comment reads.
 * Rules are tried best first in one pass, and each of them sees the row as
 * stored with what the matching rules ranked above it set on it:
 * - the category of the first of them that sets one, unless a person picked
 *   the row's category or it sits on a filed tax return;
 * - the payee of the first that sets one, unless a person picked the payee;
 * - the comment of the first that sets one, when the row has none;
 * - the tags of every one of them, added to the row's own.
 * The same order `layerRules` writes them in, so a rule asking "category is
 * empty" stays out of a row a rule above has filed. A rule below never changes
 * what one above sees. A classification pass (import, re-run) starts from the
 * row as it arrived instead of as stored: see `passStartState`.
 */
export interface RuleRowState {
  categoryId: string | null;
  categorySource: TransactionCategorySource | null;
  payeeId: string | null;
  comments: string | null;
  tagIds: readonly string[];
  /** The rule above that set each, by name, for the preview's "why". */
  setBy: Readonly<Partial<Record<'category' | 'payee' | 'comment', string>>>;
  /** The rule above that added each tag, by name. */
  tagsBy: Readonly<Record<string, string>>;
}

type StoredRow = Pick<
  Partial<Transaction>,
  'categoryId' | 'categorySource' | 'payeeId' | 'payeeSource' | 'comments' | 'tags' | 'taxLocked'
>;

/**
 * The row as stored. `tagIds` are its tags when the caller loaded them apart;
 * else the relation, when loaded; a row being imported has none.
 */
export function storedState(
  row: StoredRow,
  tagIds: readonly string[] = row.tags?.map(tag => tag.id) ?? [],
): RuleRowState {
  return {
    categoryId: row.categoryId ?? null,
    categorySource: row.categorySource ?? null,
    payeeId: row.payeeId ?? null,
    comments: row.comments ?? null,
    tagIds,
    setBy: {},
    tagsBy: {},
  };
}

/**
 * The row as a classification pass starts from it. A row classified again (the
 * re-run endpoints) still carries what the rules wrote on it the last time;
 * that is theirs to write again, not something a condition reads, or a rule
 * asking "category is empty" would stop matching the row it filed itself. So
 * the pass starts as the row arrived: no category unless a person picked it or
 * it sits on a filed tax return, no payee a rule gave, no comment or tag one of
 * `rules` writes. A person's tag or comment that equals a rule's is read as the
 * rule's, for matching only: nothing is taken off the row.
 */
export function passStartState(
  row: StoredRow,
  rules: readonly { result: ClassificationResult }[],
  tagIds?: readonly string[],
): RuleRowState {
  const state = storedState(row, tagIds);
  const ruleTags = new Set(rules.flatMap(rule => rule.result.tagIds ?? []));
  const ruleComments = new Set(rules.map(rule => rule.result.comment?.trim()).filter(Boolean));
  const keepsCategory = row.categorySource === TransactionCategorySource.MANUAL || row.taxLocked;
  return {
    ...state,
    categoryId: keepsCategory ? state.categoryId : null,
    categorySource: keepsCategory ? state.categorySource : null,
    payeeId: row.payeeSource === 'rule' ? null : state.payeeId,
    comments: ruleComments.has(state.comments?.trim()) ? null : state.comments,
    tagIds: state.tagIds.filter(tagId => !ruleTags.has(tagId)),
  };
}

/** What a matching rule leaves on the row for the rules ranked below it. */
export function layOver(
  state: RuleRowState,
  rule: { name?: string; result: ClassificationResult },
  row: StoredRow,
): RuleRowState {
  const { categoryId, payeeId, comment, tagIds } = rule.result;
  const name = rule.name ?? '';
  const next = { ...state, setBy: { ...state.setBy }, tagsBy: { ...state.tagsBy } };
  const handPicked = row.categorySource === TransactionCategorySource.MANUAL || row.taxLocked;
  if (categoryId && !('category' in state.setBy) && !handPicked) {
    next.categoryId = categoryId;
    next.categorySource = TransactionCategorySource.RULE;
    next.setBy.category = name;
  }
  if (payeeId && !('payee' in state.setBy) && !pickedByHand(row)) {
    next.payeeId = payeeId;
    next.setBy.payee = name;
  }
  if (comment && !('comment' in state.setBy) && hasNoComment(row)) {
    next.comments = comment;
    next.setBy.comment = name;
  }
  const added = (tagIds ?? []).filter(tagId => !state.tagIds.includes(tagId));
  if (added.length > 0) {
    next.tagIds = [...state.tagIds, ...added];
    for (const tagId of added) {
      next.tagsBy[tagId] = name;
    }
  }
  return next;
}
