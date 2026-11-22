import { api } from '@/app/lib/api';
import type { AppImportResult } from '@/app/lib/contracts';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export type { AppImportResult };

/** What the dialog sends beside the files: exactly the choices it shows. */
export interface AppImportOptions {
  dryRun: boolean;
  currency: string;
  categorize: boolean;
  /** The app's account name → a workspace account id, or null for a new account. */
  accounts: Record<string, string | null>;
}

const URL = '/entity-imports/apps';

/** Sends the exported files: a dry run counts what would happen, otherwise they are imported. */
export const runAppImport = async (
  files: File[],
  options: AppImportOptions,
): Promise<AppImportResult> => {
  const fields = {
    dryRun: options.dryRun ? 'true' : 'false',
    currency: options.currency,
    categorize: options.categorize ? 'true' : 'false',
    accounts: JSON.stringify(options.accounts),
  } satisfies ContractInput<'AppImportForm'>;
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }
  for (const file of files) {
    body.append('files', file, file.name);
  }
  const response = await api.post(URL, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return checkContract('AppImportResult', response.data, URL);
};

export const undoAppImport = async (batchId: string): Promise<void> => {
  await api.delete(`/entity-imports/${batchId}`);
};
