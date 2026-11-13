import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { countedSql } from '../../common/utils/counted-transactions.util';
import type { StatementCoverage } from '../../contracts';
import { Statement } from '../../entities/statement.entity';
import { normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { type CoverageInput, computeCoverage } from './statement-coverage';
import { WalletsService } from './wallets.service';

interface StatementRow {
  id: string;
  fileName: string;
  from: string | null;
  to: string | null;
  rowsFrom: string | null;
  rowsTo: string | null;
  status: string;
  balanceStart: string | null;
  balanceEnd: string | null;
  fileHash: string;
  sourceAccountIndex: number | null;
  createdAt: Date | string;
  counted: string;
  pending: string;
  rowCount: string;
  synced: boolean;
}

const amount = (value: string | null): number | null => (value === null ? null : Number(value));

/**
 * Bank statements of one account, as the coverage check sees them. Left out,
 * as everywhere a figure is shown (`counted-transactions.util`): statements in
 * the trash and ones still being read or that failed. Receipts and manual
 * entries are statements too, but of a purchase, not of the account.
 *
 * A file printing several accounts is one statement per account, each in its
 * own account (`sourceStatementId`/`sourceAccountIndex`), so this account's
 * part is the statement it holds.
 *
 * A bank feed pull is an OFX statement whose rows carry the provider's ids as
 * `<account id>:<row id>` (`providerRowKey`) under that account id: the rows
 * themselves say so, whether or not the connection still exists.
 */
const STATEMENTS_SQL = `
  SELECT s.id, s.file_name AS "fileName",
    to_char(s.statement_date_from, 'YYYY-MM-DD') AS "from",
    to_char(s.statement_date_to, 'YYYY-MM-DD') AS "to",
    s.status, s.balance_start AS "balanceStart", s.balance_end AS "balanceEnd",
    s.file_hash AS "fileHash", s.source_account_index AS "sourceAccountIndex",
    s.created_at AS "createdAt",
    rows."rowsFrom", rows."rowsTo", rows.counted, rows.pending, rows."rowCount",
    (s.file_type = 'ofx' AND rows.synced) AS synced
  FROM statements s
  CROSS JOIN LATERAL (
    SELECT to_char(MIN(r.transaction_date), 'YYYY-MM-DD') AS "rowsFrom",
      to_char(MAX(r.transaction_date), 'YYYY-MM-DD') AS "rowsTo",
      COUNT(r.id) AS "rowCount",
      COALESCE(SUM(COALESCE(r.credit, 0) - COALESCE(r.debit, 0))
        FILTER (WHERE ${countedSql('r')}), 0) AS counted,
      COALESCE(SUM(COALESCE(r.credit, 0) - COALESCE(r.debit, 0))
        FILTER (WHERE r.is_verified = false AND r.is_duplicate = false), 0) AS pending,
      COALESCE(bool_or(s.account_number IS NOT NULL
        AND left(r.document_number, length(s.account_number) + 1) = s.account_number || ':'), false) AS synced
    FROM transactions r
    WHERE r.statement_id = s.id AND r.workspace_id = s.workspace_id
  ) rows
  WHERE s.workspace_id = $1 AND s.wallet_id = $2
    AND s.deleted_at IS NULL
    AND s.status NOT IN ('error', 'processing')
    AND s.file_type NOT IN ('image', 'xml')
    AND s.file_name NOT LIKE 'manual-expense-%'
    AND COALESCE(s.parsing_details ->> 'detectedBy', '') <> 'receipt-scan'`;

/** Rows dedupe flagged in each statement, counted by the statement of the row they copy. */
const DUPLICATE_ROWS_SQL = `
  SELECT r.statement_id AS "statementId", o.statement_id AS "originalId", COUNT(*) AS count
  FROM transactions r
  JOIN transactions o ON o.id = r.duplicate_of_id AND o.workspace_id = r.workspace_id
  WHERE r.workspace_id = $1 AND r.statement_id = ANY($2::uuid[]) AND r.is_duplicate = true
    AND o.statement_id IS NOT NULL AND o.statement_id <> r.statement_id
  GROUP BY r.statement_id, o.statement_id`;

/** Which days an account's statements cover, and whether their balances hold together. */
@Injectable()
export class WalletCoverageService {
  constructor(
    @InjectRepository(Statement)
    private readonly statements: Repository<Statement>,
    private readonly wallets: WalletsService,
  ) {}

  async coverage(id: string, workspaceId: string, now = new Date()): Promise<StatementCoverage> {
    const wallet = await this.wallets.findOne(id, workspaceId);
    const rows: StatementRow[] = await this.statements.query(STATEMENTS_SQL, [
      workspaceId,
      wallet.id,
    ]);
    const copies: Array<{ statementId: string; originalId: string; count: string }> =
      rows.length === 0
        ? []
        : await this.statements.query(DUPLICATE_ROWS_SQL, [workspaceId, rows.map(row => row.id)]);

    const inputs = rows.map(
      (row): CoverageInput => ({
        id: row.id,
        fileName: row.fileName,
        from: row.from,
        to: row.to,
        rowsFrom: row.rowsFrom,
        rowsTo: row.rowsTo,
        source: row.synced ? 'bank_sync' : 'manual',
        status: row.status,
        balanceStart: amount(row.balanceStart),
        balanceEnd: amount(row.balanceEnd),
        counted: Number(row.counted) || 0,
        pending: Number(row.pending) || 0,
        rowCount: Number(row.rowCount) || 0,
        fileHash: row.fileHash,
        sourceAccountIndex: row.sourceAccountIndex,
        createdAt: new Date(row.createdAt).toISOString(),
        duplicateRowsOf: copies
          .filter(copy => copy.statementId === row.id)
          .map(copy => ({ statementId: copy.originalId, count: Number(copy.count) })),
      }),
    );
    return computeCoverage(
      wallet.id,
      normalizeCurrencyCode(wallet.currency),
      inputs,
      now.toISOString().slice(0, 10),
    );
  }
}
