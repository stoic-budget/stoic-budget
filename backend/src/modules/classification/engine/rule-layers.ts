import type { Transaction } from '../../../entities/transaction.entity';
import type {
  ClassificationResult,
  ClassificationRule,
} from '../interfaces/classification-rule.interface';
import { matchesRule } from './rule-conditions';

/** What only one rule can decide for a row. Tags are not here: every matching rule adds its own. */
export const LAYERED_FIELDS = [
  'categoryId',
  'branchId',
  'walletId',
  'article',
  'activityType',
  'ownerMemberId',
  'comment',
  'payeeId',
] as const;
export type LayeredField = (typeof LAYERED_FIELDS)[number];

type LayerRule = Pick<ClassificationRule, 'conditions' | 'result'>;

/** What the rules that match a row do to it together. */
export interface RuleLayers<R extends LayerRule = ClassificationRule> {
  /** The best-ranked matching rule that decides each field. */
  setBy: Partial<Record<LayeredField, R>>;
  /** The tags of every matching rule. */
  tagIds: string[];
  /** The rules that decided a field or added a tag, best first. */
  contributors: R[];
}

/** Whether the rule decides the field. An owner of `null` is a decision: the household. */
export function decides(result: ClassificationResult, field: LayeredField): boolean {
  return field === 'ownerMemberId' ? result.ownerMemberId !== undefined : Boolean(result[field]);
}

/** The rules that match the row, in the order given (best first). */
export function matchingRules<R extends LayerRule>(
  rules: readonly R[],
  transaction: Transaction,
): R[] {
  return rules.filter(rule => matchesRule(transaction, rule));
}

/**
 * Lays matching rules over each other, best first: a field goes to the first
 * rule that decides it, so a rule lower down still decides what the ones above
 * left alone. A rule that only tags no longer keeps the row from a category.
 */
export function layerRules<R extends LayerRule>(matching: readonly R[]): RuleLayers<R> {
  const setBy: Partial<Record<LayeredField, R>> = {};
  const tagIds = new Set<string>();
  const contributors: R[] = [];
  for (const rule of matching) {
    const before = Object.keys(setBy).length + tagIds.size;
    for (const field of LAYERED_FIELDS) {
      if (!setBy[field] && decides(rule.result, field)) {
        setBy[field] = rule;
      }
    }
    for (const tagId of rule.result.tagIds ?? []) {
      tagIds.add(tagId);
    }
    if (Object.keys(setBy).length + tagIds.size > before) {
      contributors.push(rule);
    }
  }
  return { setBy, tagIds: [...tagIds], contributors };
}
