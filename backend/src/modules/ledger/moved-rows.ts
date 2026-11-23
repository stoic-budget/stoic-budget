import { IsNull, type Repository } from 'typeorm';
import { Statement } from '../../entities/statement.entity';
import type { Transaction } from '../../entities/transaction.entity';
import type { SkipReason } from './ledger-posting.rules';

/** What names a statement's cash account. */
type CashHome = Pick<Statement, 'bankName' | 'accountNumber'>;

/**
 * A manual expense and a receipt scan are stored as statements too, but they
 * are entries of the account they name, not a bank's statement of it.
 */
const OWN_ENTRY_DETECTORS = ['manual-expense', 'receipt-scan'];

export function isOwnEntry(statement: Pick<Statement, 'parsingDetails'> | null): boolean {
  return OWN_ENTRY_DETECTORS.includes(String(statement?.parsingDetails?.detectedBy ?? ''));
}

/** The same in SQL, for a statements alias: true for a bank's statement. */
export const bankStatementSql = (alias: string): string =>
  `coalesce(${alias}."parsing_details"->>'detectedBy', '') NOT IN (${OWN_ENTRY_DETECTORS.map(d => `'${d}'`).join(', ')})`;

/** A wallet (alias) with no rows of a bank statement: its opening balance is its own to book. */
export const noBankStatementRowsSql = (wallet: string): string => `NOT EXISTS (
  SELECT 1 FROM "transactions" st JOIN "statements" ss ON ss."id" = st."statement_id"
   WHERE st."wallet_id" = ${wallet}."id" AND ${bankStatementSql('ss')})`;

/** A row (alias) booked to its wallet: on no statement, or on a manual expense or receipt. */
export const walletOwnRowSql = (
  row: string,
): string => `(${row}."statement_id" IS NULL OR NOT EXISTS (
  SELECT 1 FROM "statements" ts WHERE ts."id" = ${row}."statement_id" AND ${bankStatementSql('ts')}))`;

/**
 * The statement whose cash account a row is booked under: its own, unless a
 * rule put the row in another account than its statement's. Such a row is
 * booked where that account's money is: under the account's latest statement,
 * or, with `null`, under the wallet itself when it has none.
 */
export async function cashHomeOf(
  statements: Repository<Statement>,
  tx: Pick<Transaction, 'workspaceId' | 'walletId'>,
  statement: (CashHome & Pick<Statement, 'walletId' | 'parsingDetails'>) | null,
): Promise<CashHome | null> {
  // An expense typed in on an account is that account's money.
  if (tx.walletId && isOwnEntry(statement)) {
    return null;
  }
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
 * opening balance: a bank statement is attached to it, or it holds rows of one
 * (a manual expense or a receipt on it does not count).
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
    .createQueryBuilder('statement')
    .where('statement.workspaceId = :workspaceId', { workspaceId })
    .andWhere('statement.walletId = :walletId', { walletId })
    .andWhere(bankStatementSql('statement'))
    .getExists();
  if (attached) {
    return true;
  }
  return transactions
    .createQueryBuilder('transaction')
    .innerJoin(Statement, 'statement', 'statement.id = transaction.statementId')
    .where('transaction.workspaceId = :workspaceId', { workspaceId })
    .andWhere('transaction.walletId = :walletId', { walletId })
    .andWhere('(statement.walletId IS NULL OR statement.walletId = transaction.walletId)')
    .andWhere(bankStatementSql('statement'))
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
