import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import type { RuleLayers } from './rule-layers';

/**
 * What a rule can ask about a bank row besides its payee, purpose and amount.
 * A category asked for ahead of the row itself (a re-suggest) passes these on.
 */
export type RuleRowFacts = Pick<
  Transaction,
  | 'walletId'
  | 'ownerMemberId'
  | 'paymentType'
  | 'documentNumber'
  | 'counterpartyBin'
  | 'currency'
  | 'transactionDate'
>;

/** A rule's comment fills an empty one; what a person wrote stays. */
export function hasNoComment(row: Pick<Partial<Transaction>, 'comments'>): boolean {
  return !row.comments?.trim();
}

/** A payee a person picked for the row is theirs to change, not a rule's. */
export function pickedByHand(row: Pick<Partial<Transaction>, 'payeeSource'>): boolean {
  return row.payeeSource === 'manual';
}

/**
 * Writes what the matching rules set onto the classification: each field from
 * the best rule that decides it. A field no rule decides is left alone, and so
 * are the comment and the payee a person gave `row`. Tags
 * are not written here: they are added to a row, never assigned, and the
 * caller knows which of them still exist.
 *
 * @returns whether a rule named the owner, which then beats the wallet's.
 */
export function applyRuleLayers(
  layers: RuleLayers,
  classification: Partial<Transaction>,
  row: Pick<Partial<Transaction>, 'comments' | 'payeeSource'>,
): { ruleSetOwner: boolean } {
  const { setBy } = layers;
  if (setBy.categoryId) {
    classification.categoryId = setBy.categoryId.result.categoryId;
    classification.categorySource = TransactionCategorySource.RULE;
    classification.categoryReason = setBy.categoryId.name;
  }
  if (setBy.branchId) {
    classification.branchId = setBy.branchId.result.branchId;
  }
  if (setBy.walletId) {
    classification.walletId = setBy.walletId.result.walletId;
  }
  if (setBy.article) {
    classification.article = setBy.article.result.article;
  }
  if (setBy.activityType) {
    classification.activityType = setBy.activityType.result.activityType;
  }
  if (setBy.comment && hasNoComment(row)) {
    classification.comments = setBy.comment.result.comment;
  }
  if (setBy.payeeId && !pickedByHand(row)) {
    classification.payeeId = setBy.payeeId.result.payeeId;
    classification.payeeSource = 'rule';
  }
  if (!setBy.ownerMemberId) {
    return { ruleSetOwner: false };
  }
  classification.ownerMemberId = setBy.ownerMemberId.result.ownerMemberId;
  return { ruleSetOwner: true };
}
