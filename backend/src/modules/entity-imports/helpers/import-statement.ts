import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeFilename } from '../../../common/utils/filename.util';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';
import { BankName, FileType, Statement, StatementStatus } from '../../../entities/statement.entity';
import { TransactionType } from '../../../entities/transaction.entity';
import type { ImportContext } from '../targets/target.types';

/** One imported row as the statement's own CSV copy records it. */
export interface StatementItem {
  date: string;
  merchant: string;
  purpose: string;
  amount: number;
  type: TransactionType;
  currency: string;
  categoryName: string;
}

const csvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

/**
 * The statement imported rows belong to, exactly like converting a custom
 * table, so they show up in the statements list and can be deleted together.
 */
export async function createImportStatement(
  ctx: Pick<ImportContext, 'manager' | 'userId' | 'workspaceId' | 'fileName'>,
  items: StatementItem[],
  header: string | undefined,
  walletId: string | null,
  currency: string = items[0]?.currency ?? '',
): Promise<Statement> {
  const csv = [
    ['date', 'merchant', 'purpose', 'amount', 'type', 'currency', 'category'].join(','),
    ...items.map(item =>
      [
        item.date,
        item.merchant,
        item.purpose,
        item.amount,
        item.type,
        item.currency,
        item.categoryName,
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');
  const dates = items.map(item => new Date(item.date).getTime());
  const totalDebit = items
    .filter(item => item.type === TransactionType.EXPENSE)
    .reduce((sum, item) => sum + item.amount, 0);
  const totalCredit = items
    .filter(item => item.type === TransactionType.INCOME)
    .reduce((sum, item) => sum + item.amount, 0);
  const baseName = (ctx.fileName || 'import').replace(/\.[^.]+$/, '');
  const fileName = normalizeFilename(`${baseName}-import.csv`);
  const filePath = path.join(resolveUploadsDir(), `${randomUUID()}.csv`);
  await fs.promises.writeFile(filePath, csv);
  const repo = ctx.manager.getRepository(Statement);
  const statement = await repo.save(
    repo.create({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      fileName,
      filePath,
      fileType: FileType.CSV,
      fileSize: csv.length,
      fileHash: createHash('sha256').update(csv).digest('hex'),
      bankName: BankName.OTHER,
      status: StatementStatus.COMPLETED,
      processedAt: new Date(),
      statementDateFrom: new Date(Math.min(...dates)),
      statementDateTo: new Date(Math.max(...dates)),
      totalTransactions: items.length,
      totalDebit,
      totalCredit,
      currency,
      walletId,
      deletedAt: null,
      parsingDetails: {
        detectedBy: 'entity-import',
        parserUsed: 'entity-import',
        parserVersion: '1',
        transactionsFound: items.length,
        transactionsCreated: items.length,
        importPreview: { source: 'entity-import', fileName: ctx.fileName },
        // The header row tells the next export of this bank to the same account.
        metadataExtracted: { normalizedHeader: header },
      },
    }),
  );
  await repo.update(statement.id, { fileData: Buffer.from(csv) });
  return statement;
}
