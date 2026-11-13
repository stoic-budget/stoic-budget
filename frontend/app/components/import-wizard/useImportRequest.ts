'use client';

import { useMemo } from 'react';
import type { ImportChoices } from './import-choices';
import type { ImportRunPayload, ImportTarget } from './import-wizard-api';
import type { PreparedSheet } from './import-wizard-utils';

/**
 * What the dry run and the import both send for the sheet, or null before it
 * is read. The header row goes along so the server can tell one bank's export
 * from another's; an account and a period apply to transactions only.
 */
export function useImportRequest(
  sheet: PreparedSheet | null,
  target: ImportTarget,
  mapping: Record<string, number>,
  fileName: string | undefined,
  choices: ImportChoices,
): ImportRunPayload | null {
  const { currency, categorize, walletId, period, heldToPeriod } = choices;
  return useMemo(() => {
    const held = target === 'transactions' && heldToPeriod && period;
    return (
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
          ...(held ? { dateFrom: period.from, dateTo: period.to } : {}),
        },
      }
    );
  }, [sheet, target, mapping, fileName, currency, categorize, walletId, period, heldToPeriod]);
}
