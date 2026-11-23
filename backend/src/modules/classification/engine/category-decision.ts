import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';

/**
 * Whether a person stands behind the row's category: they picked it, or a rule
 * they wrote put it there. A category with no recorded source predates source
 * tracking and is treated as decided too, since nobody can tell otherwise.
 * Anything else (the importer's fallback, the model, a payee default) may be
 * replaced by better information.
 */
export function hasDecidedCategory(
  transaction: Pick<Transaction, 'categoryId' | 'categorySource'>,
): boolean {
  if (!transaction.categoryId) {
    return false;
  }
  return (
    transaction.categorySource === null ||
    transaction.categorySource === undefined ||
    transaction.categorySource === TransactionCategorySource.MANUAL ||
    transaction.categorySource === TransactionCategorySource.RULE
  );
}

/**
 * Whether a rule run on old rows leaves the row's category alone: a person
 * stands behind it, approved it in Review as it was suggested, or a filed
 * tax return holds the row. An approved row with no category, or still in
 * Uncategorized, still gets one.
 */
export function keepsCategoryOnRerun(
  transaction: Pick<Transaction, 'categoryId' | 'categorySource' | 'isVerified' | 'taxLocked'>,
): boolean {
  return (
    hasDecidedCategory(transaction) ||
    Boolean(transaction.taxLocked) ||
    (Boolean(transaction.isVerified) &&
      Boolean(transaction.categoryId) &&
      // Uncategorized, the importer's fallback, is no category anyone approved.
      transaction.categorySource !== TransactionCategorySource.DEFAULT)
  );
}
