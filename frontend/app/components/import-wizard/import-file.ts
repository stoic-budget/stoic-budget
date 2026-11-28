import {
  readTabularWorkbook,
  type TabularWorkbook,
} from '@/app/(main)/custom-tables/[id]/utils/tabularFileReader';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { setBrokerChecks } from './broker-checks-store';
import { readBrokerStatement } from './import-wizard-api';

/**
 * The sheets of a spreadsheet, or a broker's PDF (Revolut) as one sheet of
 * trades the server read from it; what it says that its rows do not is shown
 * beside the trade options.
 */
export async function readImportWorkbook(file: File): Promise<TabularWorkbook> {
  if (!/\.pdf$/i.test(file.name)) {
    setBrokerChecks([]);
    return readTabularWorkbook(file);
  }
  const table = await readBrokerStatement(file).catch((error: unknown) => {
    throw new BrokerReadError(getApiErrorMessage(error));
  });
  setBrokerChecks(table.checks);
  const rows = table.rows.map(row =>
    row.map(text => ({ text, kind: text ? ('text' as const) : ('empty' as const) })),
  );
  return {
    sheets: [{ name: file.name, rows, originCol: 0, sheetRows: rows.map((_, index) => index) }],
  };
}

/** Why the server would not read a broker's PDF, in the user's language. */
class BrokerReadError extends Error {}

/** What to tell when a file could not be read: the server's reason for a PDF, else the general line. */
export const readFailedMessage = (error: unknown, fallback: string): string =>
  error instanceof BrokerReadError ? error.message : fallback;
