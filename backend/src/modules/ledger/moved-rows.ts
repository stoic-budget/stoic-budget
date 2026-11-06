import { IsNull, type Repository } from 'typeorm';
import { Statement } from '../../entities/statement.entity';
import type { Transaction } from '../../entities/transaction.entity';

/** What names a statement's cash account. */
type CashHome = Pick<Statement, 'bankName' | 'accountNumber'>;

/**
 * The statement whose cash account a row is booked under: its own, unless a
 * rule put the row in another account than its statement's. Such a row is
 * booked where that account's money is: under the account's latest statement,
 * or, with `null`, under the wallet itself when it has none.
 */
export async function cashHomeOf(
  statements: Repository<Statement>,
  tx: Pick<Transaction, 'workspaceId' | 'walletId'>,
  statement: (CashHome & Pick<Statement, 'walletId'>) | null,
): Promise<CashHome | null> {
  if (!(statement?.walletId && tx.walletId) || tx.walletId === statement.walletId) {
    return statement;
  }
  return statements.findOne({
    where: { workspaceId: tx.workspaceId, walletId: tx.walletId, deletedAt: IsNull() },
    select: { id: true, bankName: true, accountNumber: true },
    order: { statementDateTo: 'DESC', createdAt: 'DESC' },
  });
}

/**
 * Whether the wallet mirrors a bank account whose statements already carry its
 * opening balance: a statement is attached to it, or it holds statement rows.
 * A row a rule moved in from another account's statement does not make it one:
 * a cash wallet that took such a row keeps its own opening.
 */
export async function mirrorsAStatement(
  transactions: Repository<Transaction>,
  workspaceId: string,
  walletId: string,
): Promise<boolean> {
  const attached = await transactions.manager
    .getRepository(Statement)
    .exists({ where: { workspaceId, walletId } });
  if (attached) {
    return true;
  }
  return transactions
    .createQueryBuilder('transaction')
    .innerJoin(Statement, 'statement', 'statement.id = transaction.statementId')
    .where('transaction.workspaceId = :workspaceId', { workspaceId })
    .andWhere('transaction.walletId = :walletId', { walletId })
    .andWhere('(statement.walletId IS NULL OR statement.walletId = transaction.walletId)')
    .getExists();
}
