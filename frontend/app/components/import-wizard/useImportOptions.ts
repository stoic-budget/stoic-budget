'use client';

import { useCallback, useState } from 'react';

/** What a sheet's import needs besides its columns, per target. */
export interface ImportOptionValues {
  /** Transactions: the account the rows came from, '' to let the server find it. */
  walletId: string;
  categorize: boolean;
  /** Trades: the investment account holdings are matched in, '' for all of them. */
  investmentAccountId: string;
  createMissingHoldings: boolean;
}

export function useImportOptions(account?: { id: string }) {
  const [values, setValues] = useState<ImportOptionValues>({
    walletId: account?.id ?? '',
    categorize: true,
    investmentAccountId: '',
    createMissingHoldings: false,
  });
  const set = useCallback(
    <K extends keyof ImportOptionValues>(key: K, value: ImportOptionValues[K]) =>
      setValues(prev => ({
        ...prev,
        [key]: value,
        // A new holding needs an account to go to: without one there is nothing to create in.
        ...(key === 'investmentAccountId' && !value ? { createMissingHoldings: false } : {}),
      })),
    [],
  );
  return { values, set };
}
