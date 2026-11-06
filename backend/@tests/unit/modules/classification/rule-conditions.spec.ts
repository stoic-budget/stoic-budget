import { BadRequestException } from '@nestjs/common';
import type { Transaction } from '@/entities/transaction.entity';
import {
  explainMatch,
  matchesConditions,
  matchesRule,
} from '@/modules/classification/engine/rule-conditions';
import { assertConditionsValid } from '@/modules/classification/helpers/rule-validation';
import type { ClassificationCondition } from '@/modules/classification/interfaces/classification-rule.interface';

const STORE = 'ACME Store - Wireless Buds';
const row = (overrides: Partial<Transaction> = {}) =>
  ({
    counterpartyName: STORE,
    paymentPurpose: 'Card payment 1001',
    amount: 25,
    currency: 'EUR',
    transactionDate: '2026-10-03',
    ...overrides,
  }) as unknown as Transaction;
const payee = (
  operator: ClassificationCondition['operator'],
  value: ClassificationCondition['value'],
): ClassificationCondition => ({ field: 'counterparty_name', operator, value });

describe('rule conditions on the amount', () => {
  it('reads a stored amount as a number: 25.00 is 25', () => {
    const stored = row({ amount: '25.00' as unknown as number });

    expect(matchesConditions(stored, [{ field: 'amount', operator: 'equals', value: 25 }])).toBe(true);
    expect(matchesConditions(stored, [{ field: 'amount', operator: 'equals', value: '25' }])).toBe(true);
    expect(matchesConditions(stored, [{ field: 'amount', operator: 'equals', value: 26 }])).toBe(false);
  });

  it('takes a range with both ends in it', () => {
    const between = (value: number, valueTo: number): ClassificationCondition[] => [
      { field: 'amount', operator: 'between', value, valueTo },
    ];

    expect(matchesConditions(row(), between(20, 30))).toBe(true);
    expect(matchesConditions(row(), between(25, 25))).toBe(true);
    expect(matchesConditions(row(), between(26, 30))).toBe(false);
    expect(matchesConditions(row({ amount: '25.00' as unknown as number }), between(20, 25))).toBe(true);
  });
});

describe('a condition with several values', () => {
  it('matches when any one of them does', () => {
    expect(matchesConditions(row(), [payee('contains', ['corner bakery', 'acme store'])])).toBe(true);
    expect(matchesConditions(row(), [payee('contains', ['corner bakery', 'garden centre'])])).toBe(false);
    expect(matchesConditions(row(), [payee('starts_with', ['corner', 'acme'])])).toBe(true);
  });

  it('still reads a rule saved with one plain value', () => {
    expect(matchesConditions(row(), [payee('contains', 'acme store')])).toBe(true);
  });
});

describe('a negated condition', () => {
  it('holds when the text is absent, and for a row with no value at all', () => {
    expect(matchesConditions(row(), [payee('not_contains', 'corner bakery')])).toBe(true);
    expect(matchesConditions(row(), [payee('not_contains', 'acme')])).toBe(false);
    expect(matchesConditions(row({ counterpartyName: null as never }), [payee('not_contains', 'acme')])).toBe(true);
  });

  it('with several values holds only when none of them matches', () => {
    expect(matchesConditions(row(), [payee('not_contains', ['corner bakery', 'garden centre'])])).toBe(true);
    expect(matchesConditions(row(), [payee('not_contains', ['corner bakery', 'acme'])])).toBe(false);
  });

  it('"is not" is the opposite of "is"', () => {
    const currency = (value: string): ClassificationCondition[] => [
      { field: 'currency', operator: 'not_equals', value },
    ];

    expect(matchesConditions(row(), currency('USD'))).toBe(true);
    expect(matchesConditions(row(), currency('EUR'))).toBe(false);
  });
});

describe('how conditions combine', () => {
  const conditions = [payee('contains', 'acme'), payee('contains', 'corner bakery')];

  it('asks for all of them unless told any one is enough', () => {
    expect(matchesConditions(row(), conditions)).toBe(false);
    expect(matchesConditions(row(), conditions, 'any')).toBe(true);
    expect(matchesRule(row(), { conditions, matchMode: 'any' })).toBe(true);
    expect(matchesRule(row(), { conditions })).toBe(false);
  });

  it('matches nothing with no conditions, in either mode', () => {
    expect(matchesConditions(row(), [])).toBe(false);
    expect(matchesConditions(row(), [], 'any')).toBe(false);
  });

  it('says which conditions held, joined the way they combine', () => {
    expect(explainMatch(row(), [payee('contains', 'acme'), payee('ends_with', 'buds')])).toBe(
      'counterparty_name contains "acme" AND counterparty_name ends_with "buds"',
    );
    expect(explainMatch(row(), conditions, 'any')).toBe('counterparty_name contains "acme"');
  });
});

describe('conditions on the currency and the day of the month', () => {
  it('matches the currency whatever its case', () => {
    expect(matchesConditions(row(), [{ field: 'currency', operator: 'equals', value: 'eur' }])).toBe(true);
    expect(matchesConditions(row(), [{ field: 'currency', operator: 'equals', value: ['USD', 'EUR'] }])).toBe(true);
    expect(matchesConditions(row(), [{ field: 'currency', operator: 'equals', value: 'USD' }])).toBe(false);
  });

  it('reads the day from a stored date and from the date of a row being imported', () => {
    const early: ClassificationCondition[] = [
      { field: 'day_of_month', operator: 'between', value: 1, valueTo: 5 },
    ];

    expect(matchesConditions(row(), early)).toBe(true);
    expect(matchesConditions(row({ transactionDate: new Date(2026, 9, 3) }), early)).toBe(true);
    expect(matchesConditions(row({ transactionDate: '2026-10-17' as never }), early)).toBe(false);
    expect(
      matchesConditions(row(), [{ field: 'day_of_month', operator: 'equals', value: 3 }]),
    ).toBe(true);
  });
});

describe('how text is compared', () => {
  it('ignores case, accents and runs of spaces, so nothing that matched before stops matching', () => {
    const bank = row({ counterpartyName: 'CAFÉ   DE  LA GARE' });

    expect(matchesConditions(bank, [payee('contains', 'cafe de la gare')])).toBe(true);
    expect(matchesConditions(bank, [payee('contains', 'CAFÉ   DE')])).toBe(true);
    expect(matchesConditions(bank, [payee('equals', 'café de la gare')])).toBe(true);
    // A condition written with a space as a word boundary keeps it.
    expect(matchesConditions(row({ counterpartyName: 'ACMEX' }), [payee('contains', 'acme ')])).toBe(false);
  });

  it('leaves a pattern as it was written', () => {
    expect(matchesConditions(row(), [payee('regex', '^acme .* buds$')])).toBe(true);
    expect(matchesConditions(row(), [payee('regex', '^buds')])).toBe(false);
  });
});

describe('what a rule may ask', () => {
  const refuses = (condition: ClassificationCondition) =>
    expect(() => assertConditionsValid([condition])).toThrow(BadRequestException);
  const accepts = (condition: ClassificationCondition) =>
    expect(() => assertConditionsValid([condition])).not.toThrow();

  it('takes several values for a text field, but not for a pattern', () => {
    accepts(payee('contains', ['acme', 'corner bakery']));
    accepts(payee('not_contains', ['acme']));
    refuses(payee('regex', ['acme', 'corner']));
  });

  it('takes a range of amounts or days in the right order', () => {
    accepts({ field: 'amount', operator: 'between', value: 10, valueTo: 20 });
    accepts({ field: 'day_of_month', operator: 'between', value: 1, valueTo: 5 });
    refuses({ field: 'amount', operator: 'between', value: 20, valueTo: 10 });
    refuses({ field: 'amount', operator: 'between', value: 10 });
    refuses({ field: 'amount', operator: 'contains', value: 10 });
    refuses({ field: 'amount', operator: 'equals', value: 10, valueTo: 20 });
    refuses(payee('between', 'acme'));
  });

  it('takes a day of the month only from 1 to 31', () => {
    accepts({ field: 'day_of_month', operator: 'equals', value: 31 });
    refuses({ field: 'day_of_month', operator: 'equals', value: 32 });
    refuses({ field: 'day_of_month', operator: 'equals', value: 1.5 });
    refuses({ field: 'day_of_month', operator: 'between', value: 0, valueTo: 5 });
  });

  it('takes a currency as three letters, is or is not', () => {
    accepts({ field: 'currency', operator: 'equals', value: 'EUR' });
    accepts({ field: 'currency', operator: 'not_equals', value: ['EUR', 'usd'] });
    refuses({ field: 'currency', operator: 'equals', value: 'euro' });
    refuses({ field: 'currency', operator: 'contains', value: 'EU' });
  });

  it('takes "is not" for a payment type, with a value from the list', () => {
    accepts({ field: 'payment_type', operator: 'not_equals', value: 'fee' });
    refuses({ field: 'payment_type', operator: 'not_equals', value: 'cheque' });
  });
});
