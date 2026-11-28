import { IsNull, type Repository } from 'typeorm';
import type { Transaction } from '../../entities/transaction.entity';

/** The figures `resolve` works out, as the row stores them. */
type Figures = Pick<
  Transaction,
  | 'taxRateId'
  | 'taxRuleId'
  | 'taxSource'
  | 'taxAmount'
  | 'taxNetAmount'
  | 'taxReverseCharge'
  | 'taxNotionalAmount'
>;

/**
 * Stores reassessed figures on a row, only while it is not filed and still has
 * what they were worked out from: an edit made meanwhile (a new category, a new
 * payee) keeps the figures its own save set, instead of an older read's.
 */
export async function writeAssignment(
  transactions: Repository<Transaction>,
  row: Transaction,
  figures: Figures,
): Promise<void> {
  await transactions.update(
    {
      id: row.id,
      workspaceId: row.workspaceId,
      taxLocked: false,
      categoryId: row.categoryId ?? IsNull(),
      payeeId: row.payeeId ?? IsNull(),
      transactionType: row.transactionType,
    },
    {
      taxRateId: figures.taxRateId,
      taxRuleId: figures.taxRuleId,
      taxSource: figures.taxSource,
      taxAmount: figures.taxAmount,
      taxNetAmount: figures.taxNetAmount,
      taxReverseCharge: figures.taxReverseCharge,
      taxNotionalAmount: figures.taxNotionalAmount,
    },
  );
}
