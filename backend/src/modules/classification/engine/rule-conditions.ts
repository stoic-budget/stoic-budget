import { OWNER_SHARED } from '../../../common/utils/transaction-owner.util';
import type { Transaction } from '../../../entities/transaction.entity';
import type {
  ClassificationCondition,
  MatchMode,
} from '../interfaces/classification-rule.interface';
import { normalizeRuleText } from './rule-text';

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

/** The value of the transaction a rule condition looks at. */
function ruleFieldValue(transaction: Transaction, field: string): string | number | null {
  switch (field) {
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

export function evaluateCondition(
  fieldValue: string | number | null,
  condition: ClassificationCondition,
): boolean {
  const positive = NEGATION_OF[condition.operator];
  if (positive) {
    // No value does not contain or equal anything, so the negation holds.
    return !evaluateCondition(fieldValue, { ...condition, operator: positive });
  }
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }
  const { value } = condition;
  if (typeof value !== 'string' && typeof value !== 'number') {
    return value.some(one => evaluateCondition(fieldValue, { ...condition, value: one }));
  }
  return NUMERIC_FIELDS.has(condition.field)
    ? numberHolds(Number(fieldValue), condition)
    : textHolds(fieldValue, condition);
}

function conditionHolds(transaction: Transaction, condition: ClassificationCondition): boolean {
  return evaluateCondition(ruleFieldValue(transaction, condition.field), condition);
}

/** Whether the row passes the conditions: all of them, or any one. None at all matches nothing. */
export function matchesConditions(
  transaction: Transaction,
  conditions: readonly ClassificationCondition[],
  mode: MatchMode = 'all',
): boolean {
  if (conditions.length === 0) {
    return false;
  }
  const holds = (condition: ClassificationCondition) => conditionHolds(transaction, condition);
  return mode === 'any' ? conditions.some(holds) : conditions.every(holds);
}

/** Whether the rule matches the row: the one place that knows how its conditions combine. */
export function matchesRule(
  transaction: Transaction,
  rule: { conditions: readonly ClassificationCondition[]; matchMode?: MatchMode | null },
): boolean {
  return matchesConditions(transaction, rule.conditions, rule.matchMode ?? 'all');
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

/** The conditions a matching row satisfied, worded for the rule preview. */
export function explainMatch(
  transaction: Transaction,
  conditions: readonly ClassificationCondition[],
  mode: MatchMode = 'all',
): string {
  return conditions
    .filter(condition => conditionHolds(transaction, condition))
    .map(condition => `${condition.field} ${condition.operator} ${wordedValue(condition)}`)
    .join(mode === 'any' ? ' OR ' : ' AND ');
}
