import { BadRequestException } from '@nestjs/common';
import { assertUnsplittable } from '@/modules/transactions/unsplit-guards';

const part = (fields: { isDuplicate?: boolean; excludedFromBudgets?: boolean } = {}) => ({
  isDuplicate: false,
  excludedFromBudgets: false,
  ...fields,
});

function codeOf(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return ((error as BadRequestException).getResponse() as { code: string }).code;
  }
}

describe('assertUnsplittable', () => {
  it('lets parts that all count, or all stay out of budgets, merge', () => {
    expect(codeOf(() => assertUnsplittable([part(), part()]))).toBeNull();
    expect(
      codeOf(() =>
        assertUnsplittable([part({ excludedFromBudgets: true }), part({ excludedFromBudgets: true })]),
      ),
    ).toBeNull();
  });

  it('refuses a part left out of budgets next to one counted in them, whichever comes first', () => {
    for (const parts of [
      [part(), part({ excludedFromBudgets: true })],
      [part({ excludedFromBudgets: true }), part()],
    ]) {
      expect(codeOf(() => assertUnsplittable(parts))).toBe('TRANSACTION_UNSPLIT_MIXED_BUDGETS');
    }
  });

  it('still refuses a duplicate first, with its own message', () => {
    expect(
      codeOf(() => assertUnsplittable([part({ isDuplicate: true }), part({ excludedFromBudgets: true })])),
    ).toBe('TRANSACTION_UNSPLIT_DUPLICATE');
  });
});
