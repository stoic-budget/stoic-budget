'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

type RecordWithCurrency = { currencyValue?: string | null; dateValue?: string | null };

/** The record's ISO day, or '' (today's rate) for a date typed in another shape. */
const dayOf = (date: string | null | undefined): string => {
  const day = (date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
};
const keyOf = (currency: string, day: string): string => `${currency}:${day}`;

/**
 * Converts amounts into `targetCurrency` at the rate of each record's own day,
 * as Reports do, so a leaderboard and the cash-flow map beside it agree. The
 * rates for every (currency, day) in `records` come in one request. An amount
 * whose currency has no rate that day is left out (0), not counted 1:1; one
 * whose rate has not arrived yet passes through until it does.
 */
export function useCurrencyConversion(
  records: RecordWithCurrency[],
  targetCurrency: string,
): {
  convert: (
    amount: number,
    currency: string | null | undefined,
    date: string | null | undefined,
  ) => number;
} {
  const [rates, setRates] = useState<Record<string, number | null>>({});

  const pairsKey = useMemo(() => {
    const set = new Set(
      records.flatMap(record => {
        const currency = (record.currencyValue || '').toUpperCase();
        return currency && currency !== targetCurrency
          ? [keyOf(currency, dayOf(record.dateValue))]
          : [];
      }),
    );
    return Array.from(set).sort().join(',');
  }, [records, targetCurrency]);

  useEffect(() => {
    const pairs = pairsKey ? pairsKey.split(',') : [];
    if (pairs.length === 0) {
      return;
    }
    let cancelled = false;

    const loadRates = async (): Promise<void> => {
      const items = pairs.map(pair => {
        const [currency, day] = pair.split(':');
        return { amount: 1, currency, date: day || null };
      });
      try {
        const body = { items, targetCurrency } satisfies ContractInput<'BulkConvertBody'>;
        const response = await apiClient.post('/exchange-rates/convert', body);
        const { results } = await checkContract(
          'BulkConversion',
          response.data,
          '/exchange-rates/convert',
        );
        if (cancelled) {
          return;
        }
        setRates(prev => {
          const next = { ...prev };
          pairs.forEach((pair, index) => {
            const result = results[index];
            next[pair] = !result || result.missing ? null : result.rate;
          });
          return next;
        });
      } catch {
        // Rates unavailable for now: amounts pass through until they load.
      }
    };

    void loadRates();
    return () => {
      cancelled = true;
    };
  }, [pairsKey, targetCurrency]);

  const convert = useCallback(
    (
      amount: number,
      currency: string | null | undefined,
      date: string | null | undefined,
    ): number => {
      const source = (currency || '').toUpperCase();
      if (!source || source === targetCurrency) {
        return amount;
      }
      const rate = rates[keyOf(source, dayOf(date))];
      if (rate === undefined) {
        return amount;
      }
      return rate === null ? 0 : amount * rate;
    },
    [rates, targetCurrency],
  );

  return { convert };
}
