import type { WalletType } from '../../../entities/wallet.entity';
import { readExportTable } from './app-file-text';
import { detectAppFormat } from './app-formats';
import type { ParsedAppFile } from './app-model';
import { parseActual } from './parsers/actual.parser';
import { fireflyAccountTypes, parseFirefly } from './parsers/firefly.parser';
import { parseYnabPlan, parseYnabRegister } from './parsers/ynab.parser';

export interface AppUpload {
  fileName: string;
  buffer: Uint8Array;
}

/** Reads one uploaded export; an unrecognised file comes back with no app and no rows. */
export function parseAppFile(
  upload: AppUpload,
  accountTypes: Map<string, WalletType>,
): ParsedAppFile {
  const { fileName } = upload;
  const table = readExportTable(upload.buffer);
  const format = detectAppFormat(table.headers);
  const empty = { fileName, txns: [], budgets: [], problems: [] };
  if (!format) {
    return { ...empty, app: null, kind: null };
  }
  const base = { ...empty, app: format.app, kind: format.kind };
  switch (format.format) {
    case 'ynab-register':
      return { ...base, ...parseYnabRegister(fileName, format, table.rows, table.delimiter) };
    case 'ynab-plan':
      return { ...base, ...parseYnabPlan(fileName, format, table.rows, table.delimiter) };
    case 'actual':
    case 'actual-basic':
      return { ...base, ...parseActual(fileName, format, table.rows) };
    case 'firefly':
      for (const [name, type] of fireflyAccountTypes(format, table.rows)) {
        accountTypes.set(name, type);
      }
      return { ...base, ...parseFirefly(fileName, format, table.rows) };
  }
}
