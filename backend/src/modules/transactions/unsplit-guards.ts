import { BadRequestException } from '@nestjs/common';
import { appError } from '../../common/errors/app-error';
import type { Transaction } from '../../entities/transaction.entity';

/**
 * Refuses to merge parts the figures would count differently. Checked on the
 * locked rows: a flag may have landed after the unlocked read.
 */
export function assertUnsplittable(
  parts: ReadonlyArray<Pick<Transaction, 'isDuplicate' | 'excludedFromBudgets'>>,
): void {
  // A part can be flagged as a duplicate AFTER the split: isSameSplitGroup only
  // excludes pairs sharing a splitGroupId, so a part stays comparable against
  // rows in other statements and markDuplicates can flag it at any time. A
  // flagged row is excluded from reports, so merging would either inflate
  // reported spend (a flagged sibling folded into the unflagged survivor) or
  // erase the whole charge (part 0 flagged, survivor keeps isDuplicate). Refuse,
  // as assertSplittable does on the way in — with its own message, so the two
  // sides are distinguishable.
  if (parts.some(part => part.isDuplicate)) {
    throw new BadRequestException(appError('TRANSACTION_UNSPLIT_DUPLICATE'));
  }
  // The same holds for a part left out of budgets next to one counted in them:
  // the merged row would carry one part's flag, putting money back into budgets
  // or taking it out. The person makes the parts agree first.
  if (new Set(parts.map(part => part.excludedFromBudgets)).size > 1) {
    throw new BadRequestException(appError('TRANSACTION_UNSPLIT_MIXED_BUDGETS'));
  }
}
