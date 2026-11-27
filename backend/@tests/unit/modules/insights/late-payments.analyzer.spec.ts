import {
  LATE_ADVICE,
  LATE_HABIT_COUNT,
  lateAdviceFor,
} from '../../../../src/modules/insights/analyzers/late-payments.analyzer';

const keysOf = (counts: Parameters<typeof lateAdviceFor>[0]) =>
  lateAdviceFor(counts).map(({ advice, count }) => [advice.key, count]);

/** The same reason twice in half a year is a habit, and each habit has its remedy. */
describe('lateAdviceFor', () => {
  it('says nothing about a reason given once', () => {
    expect(keysOf({ forgot: 1, unexpected_expense: 1, short_before_payday: 1 })).toEqual([]);
  });

  it('names a habit from the second time on, with how often', () => {
    expect(keysOf({ forgot: LATE_HABIT_COUNT })).toEqual([['stoic.late_forgot', 2]]);
    expect(keysOf({ unexpected_expense: 3 })).toEqual([['stoic.late_unexpected', 3]]);
  });

  it('counts short money before payday and late income as one habit: money that comes after the bill', () => {
    expect(keysOf({ short_before_payday: 1, income_late: 1 })).toEqual([
      ['stoic.late_short', 2],
    ]);
  });

  it('gives no advice for bank trouble or "other": they are not the person to change', () => {
    expect(keysOf({ bank_or_payment_issue: 5, other: 5 })).toEqual([]);
  });

  it('sends the forgetful and the short to the bills, the unexpected to the goals', () => {
    expect(Object.fromEntries(LATE_ADVICE.map(advice => [advice.key, advice.target]))).toEqual({
      'stoic.late_forgot': 'bills',
      'stoic.late_short': 'bills',
      'stoic.late_unexpected': 'goals',
    });
  });
});
