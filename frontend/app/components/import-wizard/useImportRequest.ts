'use client';

import { useMemo } from 'react';
import type { ImportRunPayload, ImportTarget } from './import-wizard-api';
import type { PreparedSheet } from './import-wizard-utils';
import type { ImportOptionValues } from './useImportOptions';

/**
 * What the dry run and the import both send for the sheet, or null before it
 * is read. The header row goes along so the server can tell one bank's export
 * from another's; an account applies to transactions only, an investment
 * account and "create missing holdings" to trades only.
 */
export function useImportRequest(
  sheet: PreparedSheet | null,
  target: ImportTarget,
  mapping: Record<string, number>,
  fileName: string | undefined,
  options: ImportOptionValues & { currency: string },
): ImportRunPayload | null {
  const { currency, categorize, walletId, investmentAccountId, createMissingHoldings } = options;
  return useMemo(
    () =>
      sheet && {
        target,
        mapping,
        rows: sheet.rows,
        headers: sheet.headers,
        fileName,
        options: {
          currency,
          categorize,
          walletId: (target === 'transactions' && walletId) || null,
          investmentAccountId: (target === 'trades' && investmentAccountId) || null,
          createMissingHoldings: target === 'trades' && createMissingHoldings,
        },
      },
    [
      sheet,
      target,
      mapping,
      fileName,
      currency,
      categorize,
      walletId,
      investmentAccountId,
      createMissingHoldings,
    ],
  );
}
