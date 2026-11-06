import type { PaymentType } from '@/app/lib/contracts';
import { type RuleCondition, type RuleDraftBody, type RuleMatchMode, valuesOf } from './types';

/** Puts values into a translated line: `fill('Matched {count} times', { count: 3 })`. */
export function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (line, [key, value]) => line.split(`{${key}}`).join(String(value)),
    text,
  );
}

/** The words the page uses for fields, checks and actions, as plain strings. */
export interface RuleWords {
  field: Record<RuleCondition['field'], string>;
  operator: Record<RuleCondition['operator'], string>;
  direction: Record<'income' | 'expense', string>;
  paymentType: Record<PaymentType, string>;
  and: string;
  or: string;
  category: string;
  wallet: string;
  owner: string;
  tags: string;
  comment: string;
  payee: string;
  shared: string;
  unknown: string;
}

/** How the ids a rule names are shown: by the name of what they point at. */
export interface RuleNames {
  category: (id: string) => string | null;
  wallet: (id: string) => string | null;
  owner: (memberId: string) => string | null;
  tag: (id: string) => string | null;
  payee: (id: string) => string | null;
}

function oneValue(
  field: RuleCondition['field'],
  value: string,
  words: RuleWords,
  names: RuleNames,
): string {
  switch (field) {
    case 'owner':
      return names.owner(value) ?? words.unknown;
    case 'wallet':
      return names.wallet(value) ?? words.unknown;
    case 'direction':
      return value === 'income' || value === 'expense' ? words.direction[value] : value;
    case 'payment_type':
      return words.paymentType[value as PaymentType] ?? value;
    case 'currency':
      return value.toUpperCase();
    case 'amount':
    case 'day_of_month':
      return value;
    default:
      return `“${value}”`;
  }
}

/** `“acme” or “corner bakery”`, `10–20`: what a condition is checked against. */
function conditionValue(condition: RuleCondition, words: RuleWords, names: RuleNames): string {
  if (condition.operator === 'between') {
    return `${condition.value}–${condition.valueTo}`;
  }
  return valuesOf(condition)
    .map(value => oneValue(condition.field, value, words, names))
    .join(` ${words.or} `);
}

/** `Payee contains "acme" and Amount is more than 20`, for the list and a default name. */
export function describeConditions(
  conditions: readonly RuleCondition[],
  words: RuleWords,
  names: RuleNames,
  matchMode: RuleMatchMode = 'all',
): string {
  return conditions
    .map(
      condition =>
        `${words.field[condition.field]} ${words.operator[condition.operator]} ${conditionValue(condition, words, names)}`,
    )
    .join(` ${matchMode === 'any' ? words.or : words.and} `);
}

/** `file under Groceries · account Main card · tag Gadgets`: what a matching row gets. */
export function describeResult(
  result: RuleDraftBody['result'],
  words: RuleWords,
  names: RuleNames,
): string {
  const parts: string[] = [];
  if (result.categoryId) {
    parts.push(fill(words.category, { name: names.category(result.categoryId) ?? words.unknown }));
  }
  if (result.walletId) {
    parts.push(fill(words.wallet, { name: names.wallet(result.walletId) ?? words.unknown }));
  }
  if (result.ownerMemberId !== undefined) {
    const owner =
      result.ownerMemberId === null
        ? words.shared
        : (names.owner(result.ownerMemberId) ?? words.unknown);
    parts.push(fill(words.owner, { name: owner }));
  }
  if (result.tagIds?.length) {
    const tags = result.tagIds.map(id => names.tag(id) ?? words.unknown).join(', ');
    parts.push(fill(words.tags, { names: tags }));
  }
  if (result.payeeId || result.payeeName) {
    const payee = result.payeeName ?? names.payee(result.payeeId ?? '') ?? words.unknown;
    parts.push(fill(words.payee, { name: payee }));
  }
  if (result.comment) {
    const text = result.comment;
    parts.push(fill(words.comment, { text: text.length > 40 ? `${text.slice(0, 40)}…` : text }));
  }
  return parts.join(' · ');
}

/** The counts an apply answers. */
export interface AppliedCounts {
  applied: number;
  tagged: number;
  moved: number;
  commented: number;
  renamed: number;
}

/** `2 rows refiled, 3 tagged · 1 rows moved to Cash`: what applying a rule did. */
export function describeApplied(
  done: AppliedCounts,
  texts: Record<'applied' | 'appliedAll' | 'movedPart' | 'commentedPart' | 'renamedPart', string>,
  wallet: string,
): string {
  const parts: string[] = [];
  const extra = done.moved + done.commented + done.renamed;
  if (done.tagged > 0) {
    parts.push(fill(texts.appliedAll, { applied: done.applied, tagged: done.tagged }));
  } else if (done.applied > 0 || extra === 0) {
    parts.push(fill(texts.applied, { count: done.applied }));
  }
  if (done.moved > 0) {
    parts.push(fill(texts.movedPart, { count: done.moved, wallet }));
  }
  if (done.renamed > 0) {
    parts.push(fill(texts.renamedPart, { count: done.renamed }));
  }
  if (done.commented > 0) {
    parts.push(fill(texts.commentedPart, { count: done.commented }));
  }
  return parts.join(' · ');
}
