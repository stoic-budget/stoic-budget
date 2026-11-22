import type {
  CategorizationRule,
  ClassificationConditionGroupInput,
  ClassificationConditionInput,
} from '@/app/lib/contracts';

export type Rule = CategorizationRule;
export type RuleCondition = ClassificationConditionInput;
/** Conditions that hold together, all or any of them, as one condition of the rule. */
export type RuleConditionGroup = ClassificationConditionGroupInput;
/** One entry of a rule's conditions: a condition, or a group of them one level deep. */
export type RuleNode = RuleCondition | RuleConditionGroup;
export type RuleField = RuleCondition['field'];
export type RuleOperator = RuleCondition['operator'];
export type RuleMatchMode = Rule['matchMode'];

export function isGroup(node: RuleNode): node is RuleConditionGroup {
  return 'conditions' in node;
}

/** What the editor sends on create and on edit. Where a new rule goes is the server's call (on top). */
export interface RuleDraftBody {
  name: string;
  conditions: RuleNode[];
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
    /** Matching rows leave budgets and every spending figure. */
    excludeFromBudgets?: true;
    /** Tells one member, or everyone with `null`, about each new matching row. */
    notify?: { memberId: string | null };
  };
}

/** A rule the editor opens with: an existing one, or a draft made from a transaction. */
export interface RuleSeed {
  id: string | null;
  name: string;
  conditions: RuleNode[];
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
/** Checks that take no value: the field is blank, or it is not. */
export const VALUELESS_OPERATORS: RuleOperator[] = ['is_empty', 'is_not_empty'];
/** Fields whose value is a category, payee or tags of the workspace, by id. */
export const REF_FIELDS: RuleField[] = ['category', 'payee', 'tags'];

export function operatorsFor(field: RuleField): RuleOperator[] {
  if (field === 'category' || field === 'payee' || field === 'tags') {
    return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
  }
  if (field === 'comment') {
    return ['contains', 'not_contains', 'equals', 'is_empty', 'is_not_empty'];
  }
  if (TEXT_FIELDS.includes(field)) {
    return [...TEXT_OPERATORS, ...VALUELESS_OPERATORS];
  }
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

/** A new group: any one of its conditions, beside the rule's others. */
export const EMPTY_GROUP: RuleConditionGroup = { matchMode: 'any', conditions: [EMPTY_CONDITION] };

/** The ids a rule's conditions on `field` name, those inside groups too. */
export function conditionRefs(nodes: readonly RuleNode[], field: RuleField): string[] {
  return nodes
    .flatMap(node => (isGroup(node) ? node.conditions : [node]))
    .filter(
      condition => condition.field === field && !VALUELESS_OPERATORS.includes(condition.operator),
    )
    .flatMap(valuesOf)
    .filter(Boolean);
}
