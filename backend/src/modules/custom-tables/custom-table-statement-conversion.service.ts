import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { appDefaultCurrency, currencyCodeOrDefault } from '../../common/utils/currency.util';
import { normalizeFilename } from '../../common/utils/filename.util';
import { assertNoTaxLockedTransactions } from '../../common/utils/tax-lock.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import type { TransactionsImportedEvent } from '../notifications/events/notification-events';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { CustomTableConvertedStatementsService } from './custom-table-converted-statements.service';
import { CustomTableSupportService } from './custom-table-support.service';
import { convertedRowFingerprint, flagRepeatedRows } from './helpers/converted-repeats';
import { getRowDataValue, toRowDataRecord } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import {
  buildConversionMapping,
  buildConvertedCsv,
  type ConvertedTransactionInput,
  parseConversionDate,
  parsePositiveAmount,
  readScalarString,
  toDateOnly,
} from './helpers/statement-conversion';

@Injectable()
export class CustomTableStatementConversionService {
  private readonly logger = new Logger(CustomTableStatementConversionService.name);

  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly support: CustomTableSupportService,
    private readonly convertedStatements: CustomTableConvertedStatementsService,
    // Optional for the same reason: only converting rows to a statement needs it.
    @Optional() private readonly workspaceCurrency?: WorkspaceCurrencyService,
    // Optional: converted rows are assessed when the tax module is wired in.
    @Optional() private readonly taxAssignmentService?: TaxAssignmentService,
    // Optional: announces converted rows to webhooks; unit specs build the service without it.
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  async convertToStatement(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<{
    statementId: string;
    importedRows: number;
    skippedRows: number;
    warnings: string[];
  }> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.ensureCanEditStatements(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);

    let columns: CustomTableColumn[];
    let rows: CustomTableRow[];
    try {
      [columns, rows] = await Promise.all([
        this.customTableColumnRepository.find({
          where: { tableId },
          order: { position: 'ASC' },
        }),
        this.customTableRowRepository.find({
          where: { tableId },
          order: { rowNumber: 'ASC' },
        }),
      ]);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    if (!columns.length) {
      throw new BadRequestException(appError('TABLE_NO_COLUMNS_TO_CONVERT'));
    }
    if (!rows.length) {
      throw new BadRequestException(appError('TABLE_NO_ROWS_TO_CONVERT'));
    }

    const mapping = buildConversionMapping(columns);
    const missingRequired = [
      !mapping.date ? 'date' : null,
      !mapping.amount ? 'amount' : null,
    ].filter((value): value is string => Boolean(value));

    if (missingRequired.length) {
      throw new BadRequestException(
        appError('REQUIRED_COLUMNS_UNRESOLVED', { columns: missingRequired.join(', ') }),
      );
    }

    // A money column already knows its currency; rows without an explicit one inherit it.
    const amountColumn = columns.find(column => column.key === mapping.amount);
    const amountCurrency = amountColumn?.config?.currency;
    const defaultCurrency = currencyCodeOrDefault(
      typeof amountCurrency === 'string' ? amountCurrency : null,
      await this.resolveWorkspaceCurrency(workspaceId),
    );

    const converted: ConvertedTransactionInput[] = [];
    const warnings: string[] = [];

    for (const row of rows) {
      const data = toRowDataRecord(row.data);
      const transactionDate = parseConversionDate(
        mapping.date ? getRowDataValue(data, mapping.date) : null,
      );
      const amount = parsePositiveAmount(
        mapping.amount ? getRowDataValue(data, mapping.amount) : null,
      );

      if (!transactionDate) {
        warnings.push(`row ${row.rowNumber} skipped: invalid date`);
        continue;
      }
      if (!amount) {
        warnings.push(`row ${row.rowNumber} skipped: invalid amount`);
        continue;
      }

      const merchant = readScalarString(data, mapping.merchant) || table.name;
      const purpose = readScalarString(data, mapping.purpose) || merchant;
      const currency = (readScalarString(data, mapping.currency) || defaultCurrency)
        .trim()
        .toUpperCase();
      const article = readScalarString(data, mapping.article) || null;

      converted.push({
        rowNumber: row.rowNumber,
        transactionDate,
        merchant,
        purpose,
        amount,
        currency,
        article,
      });
    }

    if (!converted.length) {
      throw new BadRequestException(appError('TABLE_NO_VALID_ROWS_TO_CONVERT'));
    }

    const existingStatement = await this.convertedStatements.findConvertedStatement(
      workspaceId,
      tableId,
    );
    const csv = buildConvertedCsv(converted);
    const fileName = normalizeFilename(`${table.name}-expenses.csv`);
    const filePath =
      existingStatement?.filePath || path.join(resolveUploadsDir(), `${randomUUID()}.csv`);
    await fs.promises.writeFile(filePath, csv);

    const statementDateFrom = new Date(
      Math.min(...converted.map(row => row.transactionDate.getTime())),
    );
    const statementDateTo = new Date(
      Math.max(...converted.map(row => row.transactionDate.getTime())),
    );
    const totalDebit = converted.reduce((sum, row) => sum + row.amount, 0);
    const currency = currencyCodeOrDefault(converted[0]?.currency);
    const fileHash = createHash('sha256').update(csv).digest('hex');

    const statementPayload: Partial<Statement> = {
      userId,
      workspaceId,
      fileName,
      filePath,
      fileType: FileType.CSV,
      fileSize: csv.length,
      fileHash,
      bankName: BankName.OTHER,
      status: StatementStatus.COMPLETED,
      processedAt: new Date(),
      statementDateFrom,
      statementDateTo,
      totalTransactions: converted.length,
      totalDebit,
      totalCredit: 0,
      currency,
      categoryId: table.categoryId ?? null,
      deletedAt: null,
      parsingDetails: {
        detectedBy: 'custom-table-conversion',
        parserUsed: 'custom-table-conversion',
        parserVersion: '1',
        transactionsFound: rows.length,
        transactionsCreated: converted.length,
        warnings,
        metadataExtracted: {
          dateFrom: toDateOnly(statementDateFrom),
          dateTo: toDateOnly(statementDateTo),
          currency,
        },
        importPreview: {
          source: 'custom-table-conversion',
          customTableId: table.id,
          tableName: table.name,
          rowsImported: converted.length,
          rowsSkipped: rows.length - converted.length,
        },
      },
    };

    // Re-converting replaces the statement's rows, and rows on a filed return may not go.
    if (existingStatement) {
      await assertNoTaxLockedTransactions(this.transactionRepository, {
        statementId: existingStatement.id,
        workspaceId,
      });
    }

    const beforeStatement = existingStatement ? { ...existingStatement } : null;
    const statement = existingStatement
      ? Object.assign(existingStatement, statementPayload)
      : this.statementRepository.create(statementPayload);
    const savedStatement = await this.statementRepository.save(statement);

    try {
      await this.statementRepository.update(savedStatement.id, { fileData: csv });
    } catch (error) {
      this.logger.warn(
        `Failed to persist converted table file in DB: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (existingStatement) {
      await this.transactionRepository.delete({ statementId: savedStatement.id });
    }

    const transactions = converted.map(row =>
      this.transactionRepository.create({
        workspaceId,
        statementId: savedStatement.id,
        transactionDate: new Date(toDateOnly(row.transactionDate)),
        counterpartyName: row.merchant,
        paymentPurpose: row.purpose,
        debit: row.amount,
        credit: null,
        amount: row.amount,
        currency: row.currency,
        article: row.article,
        transactionType: TransactionType.EXPENSE,
        categoryId: table.categoryId ?? null,
        // Converted in bulk from a table: each row is confirmed in Review.
        isVerified: false,
        fingerprint: convertedRowFingerprint(workspaceId, row),
      }),
    );
    // Identical rows import as identical statement lines do: kept, the repeat flagged.
    warnings.push(
      ...(await flagRepeatedRows(this.transactionRepository, workspaceId, transactions, converted)),
    );

    const savedTransactions = await this.transactionRepository.save(transactions);
    await this.convertedStatements.categorizeConvertedTransactions(userId, savedTransactions);
    // Converted rows are created without tax and categorised with update(),
    // which the tax subscriber never sees: assess them once they have a category.
    await this.taxAssignmentService?.reassess(workspaceId, {
      ids: savedTransactions.map(transaction => transaction.id),
    });

    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.STATEMENT,
      entityId: savedStatement.id,
      action: AuditAction.IMPORT,
      diff: { before: beforeStatement, after: savedStatement },
      meta: {
        source: 'custom-table-conversion',
        customTableId: table.id,
        rowsImported: converted.length,
        rowsSkipped: rows.length - converted.length,
      },
      isUndoable: false,
    });
    if (savedTransactions.length > 0) {
      this.eventEmitter?.emit('transactions.imported', {
        workspaceId,
        source: 'custom_table',
        statementId: savedStatement.id,
        transactionIds: savedTransactions.map(transaction => transaction.id),
      } satisfies TransactionsImportedEvent);
    }

    return {
      statementId: savedStatement.id,
      importedRows: converted.length,
      skippedRows: rows.length - converted.length,
      warnings,
    };
  }

  /** The workspace's currency, for rows whose money column does not name one. */
  private async resolveWorkspaceCurrency(workspaceId: string): Promise<string> {
    return (await this.workspaceCurrency?.resolve(workspaceId)) ?? appDefaultCurrency();
  }
}
