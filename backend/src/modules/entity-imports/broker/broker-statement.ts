import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import { resolveFileType, unlinkAll } from '../../../common/utils/file-validator.util';
import { extractTextFromPdf, extractTextLayerFromPdf } from '../../../common/utils/pdf-parser.util';
import type { BrokerStatementTable } from '../../../contracts';
import { pnlTable, tradingTable } from './broker-table';
import { isRevolutPnl, readRevolutPnl } from './revolut-pnl';
import { brokerPeriod, isRevolutTrading, readRevolutTrading } from './revolut-trading';

/** Whether a PDF's text is a broker's report this app reads as trades. */
export const isBrokerReport = (text: string) => isRevolutTrading(text) || isRevolutPnl(text);

/** A broker's PDF as the import wizard's table of trades, or the reason it is none. */
export async function brokerStatementTable(pdf: Uint8Array): Promise<BrokerStatementTable> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'broker-'));
  const file = path.join(dir, 'statement.pdf');
  try {
    await fs.promises.writeFile(file, pdf);
    const text = await extractTextFromPdf(file).catch(() => '');
    if (isRevolutTrading(text)) {
      return {
        source: 'revolut_trading',
        ...tradingTable(readRevolutTrading(text), brokerPeriod(text)),
      };
    }
    if (isRevolutPnl(text)) {
      return { source: 'revolut_pnl', ...pnlTable(readRevolutPnl(text)) };
    }
    throw new BadRequestException(appError('BROKER_STATEMENT_UNREADABLE'));
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

/**
 * A broker's report uploaded as a bank statement is refused with a pointer to
 * the trades import: read as a bank's, its trades would become spending.
 */
export async function rejectBrokerReports(files: Express.Multer.File[]): Promise<void> {
  for (const file of files) {
    if (resolveFileType(file) !== 'pdf') {
      continue;
    }
    const text = await extractTextLayerFromPdf(file.path).catch(() => '');
    if (isBrokerReport(text)) {
      await unlinkAll(files);
      throw new BadRequestException(appError('STATEMENT_IS_BROKER_REPORT'));
    }
  }
}
