import type { Repository } from 'typeorm';
import { assertNoTaxLockedTransactions } from '../../common/utils/tax-lock.util';
import type { Statement } from '../../entities/statement.entity';
import type { Transaction } from '../../entities/transaction.entity';

/**
 * Trashes the statement a scan's receipt booked, with the receipt. That takes
 * its row out of the counts, so it is refused once a filed return holds the
 * row, as trashing a statement is. Answers whether it was trashed now.
 */
export async function trashScanStatement(
  statements: Repository<Statement>,
  transactions: Repository<Transaction>,
  statementId: string,
  workspaceId: string,
): Promise<boolean> {
  const statement = await statements.findOne({ where: { id: statementId, workspaceId } });
  if (!statement || statement.deletedAt) return false;
  await assertNoTaxLockedTransactions(transactions, { statementId: statement.id, workspaceId });
  statement.deletedAt = new Date();
  await statements.save(statement);
  return true;
}
