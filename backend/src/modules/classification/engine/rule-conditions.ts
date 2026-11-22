import { OWNER_SHARED } from '../../../common/utils/transaction-owner.util';
import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import type {
  ClassificationCondition,
  MatchMode,
  RuleConditionNode,
} from '../interfaces/classification-rule.interface';
import { conditionValues, EMPTINESS_OPERATORS, isConditionGroup } from './rule-condition-tree';
import { type RuleRowState, storedState } from './rule-row-state';
import { normalizeRuleText } from './rule-text';

/** What a condition reads off a row: one value, none, or the row's tags. */
type FieldValue = string | number | null | readonly string[];

/** Fields that hold ids, compared exactly rather than as text. */
const ID_FIELDS = new Set<ClassificationCondition['field']>(['category', 'payee', 'tags']);

/** Fields compared as numbers, whatever the column hands back ("25.00"). */
const NUMERIC_FIELDS = new Set<ClassificationCondition['field']>(['amount', 'day_of_month']);

/** A negation is its positive check, turned around. */
const NEGATION_OF: Partial<
  Record<ClassificationCondition['operator'], ClassificationCondition['operator']>
> = { not_contains: 'contains', not_equals: 'equals' };

/**
 * The day number of a row's date: a `date` column reads back as 'YYYY-MM-DD',
 * and a row being imported carries the Date that will be stored as its local day.
 */
function dayOfMonth(date: Date | string | null | undefined): number | null {
  if (!date) {
    return null;
  }
  return date instanceof Date ? date.getDate() : Number(String(date).slice(8, 10)) || null;
}

/**
 * The value of the transaction a rule condition looks at. The category, payee,
 * tags and comment come from `state`: the row as the rules above left it.
 */
function ruleFieldValue(transaction: Transaction, field: string, state: RuleRowState): FieldValue {
  switch (field) {
    case 'category':
      return state.categoryId;
    case 'payee':
      return state.payeeId;
    case 'tags':
      return state.tagIds;
    case 'comment':
      return state.comments;
    case 'counterparty_name':
      return transaction.counterpartyName;
    case 'payment_purpose':
      return transaction.paymentPurpose;
    case 'amount':
      return transaction.amount || transaction.debit || transaction.credit || 0;
    case 'counterparty_bin':
      return transaction.counterpartyBin || null;
    case 'document_number':
      return transaction.documentNumber || null;
    // `shared` rather than null: the condition evaluator treats null as "no
    // value" and refuses to match, so a rule about shared rows needs a word.
    case 'owner':
      return transaction.ownerMemberId ?? OWNER_SHARED;
    case 'direction':
      return transaction.transactionType ?? null;
    case 'payment_type':
      return transaction.paymentType ?? null;
    case 'wallet':
      return transaction.walletId ?? null;
    case 'currency':
      return transaction.currency || null;
    case 'day_of_month':
      return dayOfMonth(transaction.transactionDate);
    default:
      return null;
  }
}

function numberHolds(fieldValue: number, condition: ClassificationCondition): boolean {
  const value = Number(condition.value);
  switch (condition.operator) {
    case 'equals':
      return fieldValue === value;
    case 'greater_than':
      return fieldValue > value;
    case 'less_than':
      return fieldValue < value;
    case 'between':
      return fieldValue >= value && fieldValue <= Number(condition.valueTo);
    default:
      return false;
  }
}

function textHolds(fieldValue: string | number, condition: ClassificationCondition): boolean {
  if (condition.operator === 'regex') {
    // A pattern is taken as written, against the lower-cased field as ever.
    try {
      return new RegExp(String(condition.value), 'i').test(String(fieldValue).toLowerCase());
    } catch {
      return false;
    }
  }
  const field = normalizeRuleText(fieldValue);
  const value = normalizeRuleText(condition.value);
  switch (condition.operator) {
    case 'contains':
      return field.includes(value);
    case 'equals':
      return field === value;
    case 'starts_with':
      return field.startsWith(value);
    case 'ends_with':
      return field.endsWith(value);
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    default:
      return false;
  }
}

/** No value: nothing, blank text, no tags. */
function isBlank(fieldValue: FieldValue | undefined): boolean {
  if (fieldValue === null || fieldValue === undefined) {
    return true;
  }
  return typeof fieldValue === 'object'
    ? fieldValue.length === 0
    : String(fieldValue).trim() === '';
}

export function evaluateCondition(
  fieldValue: FieldValue,
  condition: ClassificationCondition,
): boolean {
  if (EMPTINESS_OPERATORS.has(condition.operator)) {
    return isBlank(fieldValue) === (condition.operator === 'is_empty');
  }
  const positive = NEGATION_OF[condition.operator];
  if (positive) {
    // No value does not contain or equal anything, so the negation holds.
    return !evaluateCondition(fieldValue, { ...condition, operator: positive });
  }
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }
  if (typeof fieldValue === 'object') {
    // Tags: the row has one of the values. Its negation, then, has none of them.
    return fieldValue.some(one => evaluateCondition(one, condition));
  }
  const { value } = condition;
  if (typeof value !== 'string' && typeof value !== 'number') {
    return value.some(one => evaluateCondition(fieldValue, { ...condition, value: one }));
  }
  if (ID_FIELDS.has(condition.field)) {
    return condition.operator === 'equals' && String(fieldValue) === String(value);
  }
  return NUMERIC_FIELDS.has(condition.field)
    ? numberHolds(Number(fieldValue), condition)
    : textHolds(fieldValue, condition);
}

function conditionHolds(
  transaction: Transaction,
  condition: ClassificationCondition,
  state: RuleRowState,
): boolean {
  const value = ruleFieldValue(transaction, condition.field, state);
  // The importer's Uncategorized fallback is no category anybody chose: blank.
  const fallback =
    condition.field === 'category' &&
    state.categorySource === TransactionCategorySource.DEFAULT &&
    EMPTINESS_OPERATORS.has(condition.operator);
  return evaluateCondition(fallback ? null : value, condition);
}

function nodeHolds(
  transaction: Transaction,
  node: RuleConditionNode,
  state: RuleRowState,
): boolean {
  return isConditionGroup(node)
    ? matchesConditions(transaction, node.conditions, node.matchMode, state)
    : conditionHolds(transaction, node, state);
}

/**
 * Whether the row passes the conditions: all of them, or any one; a group
 * passes by its own all or any. None at all matches nothing. `state` is the
 * row as the rules above left it (rule-row-state); the row as stored without.
 */
export function matchesConditions(
  transaction: Transaction,
  conditions: readonly RuleConditionNode[],
  mode: MatchMode = 'all',
  state: RuleRowState = storedState(transaction),
): boolean {
  if (conditions.length === 0) {
    return false;
  }
  const holds = (node: RuleConditionNode) => nodeHolds(transaction, node, state);
  return mode === 'any' ? conditions.some(holds) : conditions.every(holds);
}

/** Whether the rule matches the row: the one place that knows how its conditions combine. */
export function matchesRule(
  transaction: Transaction,
  rule: { conditions: readonly RuleConditionNode[]; matchMode?: MatchMode | null },
  state?: RuleRowState,
): boolean {
  return matchesConditions(transaction, rule.conditions, rule.matchMode ?? 'all', state);
}

function wordedValue(condition: ClassificationCondition): string {
  const { value, valueTo } = condition;
  if (condition.operator === 'between') {
    return `${value}..${valueTo}`;
  }
  return typeof value === 'string' || typeof value === 'number'
    ? `"${value}"`
    : value.map(one => `"${one}"`).join(' or ');
}

/** The rules above whose doing the value a condition read was, by name. */
function settersOf(condition: ClassificationCondition, state: RuleRowState): string[] {
  switch (condition.field) {
    case 'category':
      return [state.setBy.category ?? []].flat();
    case 'payee':
      return [state.setBy.payee ?? []].flat();
    case 'comment':
      return [state.setBy.comment ?? []].flat();
    case 'tags': {
      // The tags this condition found: the ones it names, or any for "has a tag".
      const named = new Set(conditionValues(condition).map(String));
      const found = Object.entries(state.tagsBy).filter(
        ([tagId]) =>
          condition.operator === 'is_not_empty' ||
          (condition.operator === 'equals' && named.has(tagId)),
      );
      return [...new Set(found.map(([, name]) => name))];
    }
    default:
      return [];
  }
}

function wordedCondition(condition: ClassificationCondition, state: RuleRowState): string {
  const check = EMPTINESS_OPERATORS.has(condition.operator)
    ? `${condition.field} ${condition.operator}`
    : `${condition.field} ${condition.operator} ${wordedValue(condition)}`;
  const setters = settersOf(condition, state);
  return setters.length > 0
    ? `${check} (set by ${setters.map(name => `"${name}"`).join(', ')})`
    : check;
}

/**
 * The conditions a matching row satisfied, worded for the rule preview; a
 * group in brackets. A category, payee, comment or tags a rule above set is
 * named with that rule.
 */
export function explainMatch(
  transaction: Transaction,
  conditions: readonly RuleConditionNode[],
  mode: MatchMode = 'all',
  state: RuleRowState = storedState(transaction),
): string {
  return conditions
    .filter(node => nodeHolds(transaction, node, state))
    .map(node =>
      isConditionGroup(node)
        ? `(${explainMatch(transaction, node.conditions, node.matchMode, state)})`
        : wordedCondition(node, state),
    )
    .join(mode === 'any' ? ' OR ' : ' AND ');
}
