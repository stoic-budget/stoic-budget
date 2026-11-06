import type { CategorizationRule, ClassificationConditionInput } from '@/app/lib/contracts';

export type Rule = CategorizationRule;
export type RuleCondition = ClassificationConditionInput;
export type RuleField = RuleCondition['field'];
export type RuleOperator = RuleCondition['operator'];
export type RuleMatchMode = Rule['matchMode'];

/** What the editor sends on create and on edit. Where a new rule goes is the server's call (on top). */
export interface RuleDraftBody {
  name: string;
  conditions: RuleCondition[];
  matchMode: RuleMatchMode;
  result: {
    categoryId?: string;
    walletId?: string;
    ownerMemberId?: string | null;
    tagIds?: string[];
    /** Written as the row's comment when it has none. */
    comment?: string;
    payeeId?: string;
    /** A payee the workspace does not have yet: made when the rule is saved. */
    payeeName?: string;
  };
}

/** A rule the editor opens with: an existing one, or a draft made from a transaction. */
export interface RuleSeed {
  id: string | null;
  name: string;
  conditions: RuleCondition[];
  matchMode: RuleMatchMode;
  result: RuleDraftBody['result'];
}

/** The fields the editor offers; the rest stay reachable through the API. */
export const TEXT_FIELDS: RuleField[] = ['counterparty_name', 'payment_purpose'];
/** Fields compared as numbers. */
export const NUMBER_FIELDS: RuleField[] = ['amount', 'day_of_month'];
/** Fields whose condition can hold several values, any of which matches. */
export const MULTI_VALUE_FIELDS: RuleField[] = [...TEXT_FIELDS, 'currency'];
export const TEXT_OPERATORS: RuleOperator[] = [
  'contains',
  'not_contains',
  'equals',
  'not_equals',
  'starts_with',
  'ends_with',
];
export const AMOUNT_OPERATORS: RuleOperator[] = ['greater_than', 'less_than', 'equals', 'between'];

export function operatorsFor(field: RuleField): RuleOperator[] {
  if (field === 'amount') {
    return AMOUNT_OPERATORS;
  }
  if (field === 'day_of_month') {
    return ['equals', 'between', 'greater_than', 'less_than'];
  }
  if (field === 'currency' || field === 'payment_type') {
    return ['equals', 'not_equals'];
  }
  if (field === 'owner' || field === 'direction' || field === 'wallet') {
    return ['equals'];
  }
  return TEXT_OPERATORS;
}

/** The values a condition holds: several for "any of them", else its one. */
export function valuesOf(condition: Pick<RuleCondition, 'value'>): string[] {
  const { value } = condition;
  return typeof value === 'string' || typeof value === 'number' ? [String(value)] : [...value];
}

export const EMPTY_CONDITION: RuleCondition = {
  field: 'counterparty_name',
  operator: 'contains',
  value: '',
};
