import { BadRequestException } from '@nestjs/common';
import { type Transaction, TransactionCategorySource } from '@/entities/transaction.entity';
import { replaceConditionRefs } from '@/modules/classification/engine/rule-condition-tree';
import {
  explainMatch,
  matchesConditions,
  matchesRule,
} from '@/modules/classification/engine/rule-conditions';
import { passRules } from '@/modules/classification/engine/rule-layers';
import { storedState } from '@/modules/classification/engine/rule-row-state';
import { assertConditionsValid } from '@/modules/classification/helpers/rule-validation';
import type {
  ClassificationCondition,
  RuleConditionNode,
} from '@/modules/classification/interfaces/classification-rule.interface';

const STORE = 'ACME Store - Wireless Buds';
const GROCERIES = '11111111-1111-4111-8111-111111111111';
const GADGETS = '22222222-2222-4222-8222-222222222222';
const UNCATEGORIZED = '33333333-3333-4333-8333-333333333333';
const TAG_WORK = '44444444-4444-4444-8444-444444444444';
const TAG_GIFT = '55555555-5555-4555-8555-555555555555';
const PAYEE_ACME = '66666666-6666-4666-8666-666666666666';
const PAYEE_OTHER = '77777777-7777-4777-8777-777777777777';

const row = (overrides: Partial<Transaction> = {}) =>
  ({
    counterpartyName: STORE,
    paymentPurpose: 'Card payment 1001',
    amount: 25,
    currency: 'EUR',
    categoryId: null,
    categorySource: null,
    payeeId: null,
    payeeSource: null,
    comments: null,
    transactionDate: '2026-10-03',
    ...overrides,
  }) as unknown as Transaction;
const when = (
  field: ClassificationCondition['field'],
  operator: ClassificationCondition['operator'],
  value: ClassificationCondition['value'] = '',
): ClassificationCondition => ({ field, operator, value });
const holds = (transaction: Transaction, ...conditions: RuleConditionNode[]) =>
  matchesConditions(transaction, conditions);
const tagged = (...ids: string[]) => row({ tags: ids.map(id => ({ id })) as Transaction['tags'] });

describe('a condition on the category', () => {
  const filed = row({ categoryId: GROCERIES, categorySource: TransactionCategorySource.HISTORY });

  it('is one of the ids, none of them, or blank', () => {
    expect(holds(filed, when('category', 'equals', GROCERIES))).toBe(true);
    expect(holds(filed, when('category', 'equals', [GADGETS, GROCERIES]))).toBe(true);
    expect(holds(filed, when('category', 'equals', GADGETS))).toBe(false);
    expect(holds(filed, when('category', 'not_equals', GADGETS))).toBe(true);
    expect(holds(filed, when('category', 'not_equals', GROCERIES))).toBe(false);
    expect(holds(filed, when('category', 'is_empty'))).toBe(false);
    expect(holds(row(), when('category', 'is_empty'))).toBe(true);
    expect(holds(row(), when('category', 'is_not_empty'))).toBe(false);
  });

  it("takes the importer's Uncategorized fallback for blank, yet still for itself by id", () => {
    const fallback = row({
      categoryId: UNCATEGORIZED,
      categorySource: TransactionCategorySource.DEFAULT,
    });

    expect(holds(fallback, when('category', 'is_empty'))).toBe(true);
    expect(holds(fallback, when('category', 'is_not_empty'))).toBe(false);
    expect(holds(fallback, when('category', 'equals', UNCATEGORIZED))).toBe(true);
    // Picked by hand, the same category is somebody's choice.
    const picked = row({ categoryId: UNCATEGORIZED, categorySource: TransactionCategorySource.MANUAL });
    expect(holds(picked, when('category', 'is_empty'))).toBe(false);
  });

  it('compares ids whole', () => {
    expect(holds(filed, when('category', 'equals', GROCERIES.slice(0, 8)))).toBe(false);
  });
});

describe('a condition on the tags', () => {
  it('has any of them, none of them, no tags or some tag', () => {
    expect(holds(tagged(TAG_WORK), when('tags', 'equals', [TAG_GIFT, TAG_WORK]))).toBe(true);
    expect(holds(tagged(TAG_WORK), when('tags', 'equals', TAG_GIFT))).toBe(false);
    expect(holds(tagged(TAG_WORK), when('tags', 'not_equals', TAG_GIFT))).toBe(true);
    expect(holds(tagged(TAG_WORK, TAG_GIFT), when('tags', 'not_equals', [TAG_GIFT]))).toBe(false);
    expect(holds(tagged(), when('tags', 'not_equals', TAG_GIFT))).toBe(true);
    expect(holds(tagged(), when('tags', 'is_empty'))).toBe(true);
    expect(holds(tagged(TAG_WORK), when('tags', 'is_empty'))).toBe(false);
    expect(holds(tagged(TAG_WORK), when('tags', 'is_not_empty'))).toBe(true);
  });

  it('reads tags loaded apart over the relation', () => {
    const state = storedState(tagged(), [TAG_GIFT]);

    expect(matchesConditions(tagged(), [when('tags', 'equals', TAG_GIFT)], 'all', state)).toBe(true);
  });
});

describe('a condition on the payee', () => {
  it('is the payee, not it, or none', () => {
    const acme = row({ payeeId: PAYEE_ACME });

    expect(holds(acme, when('payee', 'equals', PAYEE_ACME))).toBe(true);
    expect(holds(acme, when('payee', 'not_equals', PAYEE_ACME))).toBe(false);
    expect(holds(acme, when('payee', 'not_equals', PAYEE_OTHER))).toBe(true);
    expect(holds(acme, when('payee', 'is_empty'))).toBe(false);
    expect(holds(row(), when('payee', 'is_empty'))).toBe(true);
    // No payee is not the payee, so "is not" holds.
    expect(holds(row(), when('payee', 'not_equals', PAYEE_ACME))).toBe(true);
  });
});

describe('a condition on the comment, and blank text', () => {
  it('contains, equals, or is blank', () => {
    const noted = row({ comments: 'Shared with Member One' });

    expect(holds(noted, when('comment', 'contains', 'member one'))).toBe(true);
    expect(holds(noted, when('comment', 'equals', 'shared with member one'))).toBe(true);
    expect(holds(noted, when('comment', 'is_empty'))).toBe(false);
    expect(holds(noted, when('comment', 'is_not_empty'))).toBe(true);
    expect(holds(row({ comments: '   ' }), when('comment', 'is_empty'))).toBe(true);
    expect(holds(row(), when('comment', 'is_empty'))).toBe(true);
    expect(holds(row(), when('comment', 'contains', 'member'))).toBe(false);
  });

  it('asks whether the purpose or the payee text is there at all', () => {
    expect(holds(row({ paymentPurpose: '' }), when('payment_purpose', 'is_empty'))).toBe(true);
    expect(holds(row(), when('payment_purpose', 'is_empty'))).toBe(false);
    expect(holds(row(), when('counterparty_name', 'is_not_empty'))).toBe(true);
  });
});

describe('groups one level deep', () => {
  const acme = when('counterparty_name', 'contains', 'acme store');
  const small = when('amount', 'less_than', 10);
  const eur = when('currency', 'equals', 'EUR');

  it('all of the root, one of which is any of a group', () => {
    const rule = {
      conditions: [acme, { matchMode: 'any' as const, conditions: [small, eur] }],
      matchMode: 'all' as const,
    };

    expect(matchesRule(row(), rule)).toBe(true);
    expect(matchesRule(row({ currency: 'USD' }), rule)).toBe(false);
    expect(matchesRule(row({ currency: 'USD', amount: 5 }), rule)).toBe(true);
  });

  it('any of the root, one of which is all of a group', () => {
    const rule = {
      conditions: [
        when('counterparty_name', 'contains', 'corner bakery'),
        { matchMode: 'all' as const, conditions: [acme, small] },
      ],
      matchMode: 'any' as const,
    };

    expect(matchesRule(row(), rule)).toBe(false);
    expect(matchesRule(row({ amount: 5 }), rule)).toBe(true);
  });

  it('reads a rule stored before groups, a flat list with no mode, as it always did', () => {
    const stored = JSON.parse(
      JSON.stringify({
        conditions: [acme, when('amount', 'greater_than', 20)],
        matchMode: null,
      }),
    );

    expect(matchesRule(row(), stored)).toBe(true);
    expect(matchesRule(row({ amount: 15 }), stored)).toBe(false);
    expect(matchesRule(row({ amount: 15 }), { ...stored, matchMode: 'any' })).toBe(true);
  });

  it('words a group in brackets, with only the conditions that held', () => {
    const conditions = [acme, { matchMode: 'any' as const, conditions: [small, eur] }];

    expect(explainMatch(row(), conditions)).toBe(
      'counterparty_name contains "acme store" AND (currency equals "EUR")',
    );
    expect(explainMatch(row({ comments: '' }), [when('comment', 'is_empty')])).toBe(
      'comment is_empty',
    );
  });
});

describe('one pass of the rules', () => {
  const groceries = {
    name: 'Shop is groceries',
    conditions: [when('counterparty_name', 'contains', 'acme')],
    result: { categoryId: GROCERIES, tagIds: [TAG_WORK], payeeId: PAYEE_ACME, comment: 'Weekly' },
  };
  const stillBlank = {
    name: 'Blank is gadgets',
    conditions: [when('category', 'is_empty')],
    result: { categoryId: GADGETS },
  };
  const afterGroceries = {
    name: 'Groceries are tagged',
    conditions: [when('category', 'equals', GROCERIES), when('tags', 'equals', TAG_WORK)],
    result: { tagIds: [TAG_GIFT] },
  };

  it('shows each rule the row as the matching rules above left it', () => {
    const pass = passRules([groceries, stillBlank, afterGroceries], row());

    expect(pass.matching.map(rule => rule.name)).toEqual(['Shop is groceries', 'Groceries are tagged']);
    expect(pass.state).toMatchObject({
      categoryId: GROCERIES,
      payeeId: PAYEE_ACME,
      comments: 'Weekly',
      tagIds: [TAG_WORK, TAG_GIFT],
    });
  });

  it('never lets a rule below change what one above saw', () => {
    const pass = passRules([stillBlank, groceries], row());

    expect(pass.matching.map(rule => rule.name)).toEqual(['Blank is gadgets', 'Shop is groceries']);
    // The first rule that sets a category keeps it.
    expect(pass.state.categoryId).toBe(GADGETS);
  });

  it("keeps a category a person picked, or one on a filed return, under the rules' own", () => {
    const picked = row({ categoryId: GADGETS, categorySource: TransactionCategorySource.MANUAL });
    const locked = row({
      categoryId: GADGETS,
      categorySource: TransactionCategorySource.RULE,
      taxLocked: true,
    } as Partial<Transaction>);
    const isGadgets = { name: 'gadgets', conditions: [when('category', 'equals', GADGETS)], result: {} };

    expect(passRules([groceries, isGadgets], picked).matching).toHaveLength(2);
    expect(passRules([groceries, isGadgets], locked).matching).toHaveLength(2);
    const guessed = row({ categoryId: GADGETS, categorySource: TransactionCategorySource.HISTORY });
    expect(passRules([groceries, isGadgets], guessed).matching).toHaveLength(1);
  });

  it("keeps a payee a person picked and a comment a person wrote", () => {
    const own = row({ payeeId: PAYEE_OTHER, payeeSource: 'manual', comments: 'Mine' });
    const pass = passRules([groceries], own);

    expect(pass.state.payeeId).toBe(PAYEE_OTHER);
    expect(pass.state.comments).toBe('Mine');
    const byRule = passRules([groceries], row({ payeeId: PAYEE_OTHER, payeeSource: 'rule' }));
    expect(byRule.state.payeeId).toBe(PAYEE_ACME);
  });

  it('names the rule above that set what a condition read', () => {
    const { state } = passRules([groceries], row());

    expect(explainMatch(row(), afterGroceries.conditions, 'all', state)).toBe(
      `category equals "${GROCERIES}" (set by "Shop is groceries") AND tags equals "${TAG_WORK}" (set by "Shop is groceries")`,
    );
    // A tag the row had of its own names nobody.
    const own = storedState(tagged(TAG_WORK));
    expect(explainMatch(tagged(TAG_WORK), [when('tags', 'equals', TAG_WORK)], 'all', own)).toBe(
      `tags equals "${TAG_WORK}"`,
    );
  });
});

describe('validation of the new conditions', () => {
  const invalid = (...conditions: RuleConditionNode[]) =>
    expect(() => assertConditionsValid(conditions)).toThrow(BadRequestException);

  it('takes the checks each new field has', () => {
    expect(() =>
      assertConditionsValid([
        when('category', 'equals', GROCERIES),
        when('category', 'is_empty'),
        when('tags', 'not_equals', [TAG_WORK, TAG_GIFT]),
        when('payee', 'is_not_empty'),
        when('comment', 'contains', 'weekly'),
        when('comment', 'is_empty'),
        when('payment_purpose', 'is_empty'),
      ]),
    ).not.toThrow();
    invalid(when('tags', 'contains', TAG_WORK));
    invalid(when('category', 'regex', GROCERIES));
    invalid(when('amount', 'is_empty'));
    invalid(when('currency', 'is_empty'));
  });

  it('wants an id for a category, payee or tag, and no value for a blank check', () => {
    invalid(when('category', 'equals', 'Groceries'));
    invalid(when('payee', 'equals', [PAYEE_ACME, 'ACME Store']));
    invalid(when('comment', 'is_empty', 'weekly'));
    invalid(when('tags', 'is_empty', TAG_WORK));
  });

  it('checks the conditions inside a group too', () => {
    invalid({ matchMode: 'any', conditions: [when('category', 'equals', 'Groceries')] });
    invalid({ matchMode: 'all', conditions: [when('counterparty_name', 'regex', '(')] });
  });
});

describe('a payee folded into another', () => {
  it('is the one the conditions ask about from then on, inside groups too', () => {
    const conditions: RuleConditionNode[] = [
      when('payee', 'equals', PAYEE_OTHER),
      when('counterparty_name', 'equals', PAYEE_OTHER),
      { matchMode: 'any', conditions: [when('payee', 'not_equals', [PAYEE_OTHER, PAYEE_ACME])] },
    ];

    expect(replaceConditionRefs(conditions, 'payee', new Set([PAYEE_OTHER]), PAYEE_ACME)).toEqual([
      when('payee', 'equals', PAYEE_ACME),
      when('counterparty_name', 'equals', PAYEE_OTHER),
      { matchMode: 'any', conditions: [when('payee', 'not_equals', [PAYEE_ACME])] },
    ]);
  });
});
