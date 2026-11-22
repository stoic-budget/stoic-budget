import type { UpdateTransactionBody } from '../../../contracts';
import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';

/**
 * What a person decides on a row stays decided: re-classification and rules
 * leave it alone.
 * - A category they pick. Moving in or out of `Private` is not such a pick: it
 *   would overwrite the reason the row was categorised the way it was, which
 *   the owner still needs.
 * - Counting the row in budgets or leaving it out, either way.
 */
export function markChoicesByHand(
  transaction: Transaction,
  update: Pick<UpdateTransactionBody, 'categoryId' | 'excludedFromBudgets'>,
  {
    previousCategoryId,
    movedForPrivacy,
  }: { previousCategoryId: string | null; movedForPrivacy: boolean },
): void {
  if (
    !movedForPrivacy &&
    update.categoryId !== undefined &&
    update.categoryId !== previousCategoryId
  ) {
    transaction.categorySource = update.categoryId ? TransactionCategorySource.MANUAL : null;
    transaction.categoryReason = null;
  }
  if (update.excludedFromBudgets !== undefined) {
    transaction.budgetsSetByHand = true;
  }
}
