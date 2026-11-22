import type { SelectQueryBuilder } from 'typeorm';
import { type Statement, StatementStatus } from '../../entities/statement.entity';

/** Statements whose rows are read and real; the same set the balance sheet trusts. */
const LIVE_STATEMENT_STATUSES = [
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
];

/**
 * Narrows `statement` to bank statements of the workspace's accounts: read and
 * not deleted. Receipts and manual entries are statements too, but not of a
 * bank account, and a one-row file that names no account says nothing of one.
 */
export function onlyBankStatements(
  query: SelectQueryBuilder<Statement>,
): SelectQueryBuilder<Statement> {
  return query
    .andWhere('statement.deletedAt IS NULL')
    .andWhere('statement.status IN (:...statuses)', { statuses: LIVE_STATEMENT_STATUSES })
    .andWhere("statement.fileType <> 'image'")
    .andWhere("statement.fileName NOT LIKE 'manual-expense-%'")
    .andWhere(
      "((statement.accountNumber IS NOT NULL AND statement.accountNumber <> 'Unknown') OR statement.balanceEnd IS NOT NULL OR statement.totalTransactions > 1)",
    );
}
