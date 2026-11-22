import { IsNull, type Repository } from 'typeorm';
import { Statement } from '../../entities/statement.entity';
import type { Transaction } from '../../entities/transaction.entity';
import type { SkipReason } from './ledger-posting.rules';

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

/**
 * Why interest split off a loan payment (loans/loan-interest-row) is not
 * booked: it has no statement of its own and counts only while its payment
 * does (`countedSql`), so a payment in Review, flagged a duplicate or on a
 * statement in the trash keeps its interest out of the ledger too. Null for
 * every other row, and for interest whose payment counts.
 */
export async function interestSkip(
  transactions: Repository<Transaction>,
  tx: Pick<Transaction, 'workspaceId' | 'loanInterestOfId'>,
): Promise<SkipReason | 'statement_deleted' | null> {
  if (!tx.loanInterestOfId) {
    return null;
  }
  const [payment]: Array<{ is_duplicate: boolean; is_verified: boolean; trashed: boolean }> =
    await transactions.query(
      `SELECT p."is_duplicate", p."is_verified", (s."deleted_at" IS NOT NULL) AS "trashed"
         FROM "transactions" p LEFT JOIN "statements" s ON s."id" = p."statement_id"
        WHERE p."id" = $1 AND p."workspace_id" = $2`,
      [tx.loanInterestOfId, tx.workspaceId],
    );
  if (!payment) {
    return null;
  }
  if (payment.is_duplicate) {
    return 'duplicate';
  }
  if (!payment.is_verified) {
    return 'unconfirmed';
  }
  return payment.trashed ? 'statement_deleted' : null;
}
