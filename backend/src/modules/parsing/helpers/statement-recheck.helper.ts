import type { ParseCheck, ParseCheckCode } from '../interfaces/parsed-statement.interface';

/**
 * Checks of the reading row by row, against the running balance and the
 * labelled figures printed beside the rows. Once rows are corrected by hand
 * they say nothing of the rows as they are: the opening balance plus the
 * movements against the closing one (`balance_mismatch`) takes their place.
 */
const ROW_CHECKS = new Set<ParseCheckCode>(['balance_chain', 'section_totals', 'printed_balances']);

/** Sums within a cent are the same sum. */
const TOLERANCE = 0.01;

/**
 * The parser's checks held against the rows as they are now, after rows were
 * edited, added or deleted by hand. A printed total that failed is compared
 * with the new sum of its side. Row-by-row checks are left out when both
 * balances are known (the balance equation stands for them), and kept as they
 * were otherwise, for a person to confirm.
 */
export function recheckedChecks(
  stored: readonly ParseCheck[],
  sums: { debits: number; credits: number },
  hasBalances: boolean,
): ParseCheck[] {
  return stored.flatMap(check => {
    if (hasBalances && ROW_CHECKS.has(check.code)) {
      return [];
    }
    const { side, expected } = check.detail ?? {};
    if (
      check.code === 'printed_totals' &&
      (side === 'debits' || side === 'credits') &&
      expected !== undefined
    ) {
      const actual = Math.round(sums[side] * 100) / 100;
      return [
        {
          ...check,
          passed: Math.abs(actual - expected) <= TOLERANCE,
          detail: { ...check.detail, actual },
        },
      ];
    }
    return [check];
  });
}
