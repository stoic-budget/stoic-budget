'use client';

import { Alert } from '@mui/material';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import type { TaxReturnPreview } from '@/app/lib/contracts';

/**
 * What an unfiled return leaves out: rows with no exchange rate for their day
 * (it cannot be filed with them), rows still waiting in Review (it can, but
 * their VAT is not in it until they are approved) and rows with no category,
 * for which no tax is worked out at all.
 */
export function ReturnWarnings({
  totals,
}: {
  totals:
    | Pick<TaxReturnPreview, 'missingRates' | 'awaitingReview' | 'uncategorized'>
    | null
    | undefined;
}): React.ReactElement | null {
  const t = useIntlayer('taxReturnView');
  if (!totals) return null;
  const currencies = [...new Set(totals.missingRates.map(row => row.currency))].join(', ');
  return (
    <>
      {totals.missingRates.length > 0 ? (
        <Alert severity="warning">
          {t.missingRates.value
            .replace('{count}', String(totals.missingRates.length))
            .replace('{currencies}', currencies)}
        </Alert>
      ) : null}
      {totals.awaitingReview > 0 ? (
        <Alert severity="warning">
          {t.awaitingReview.value.replace('{count}', String(totals.awaitingReview))}
        </Alert>
      ) : null}
      {totals.uncategorized > 0 ? (
        <Alert severity="warning">
          {t.uncategorized.value.replace('{count}', String(totals.uncategorized))}
        </Alert>
      ) : null}
    </>
  );
}

/**
 * Whether to file: at once when nothing waits in Review, otherwise once the
 * person agrees that those rows stay out of the return for good.
 */
export function mayFile(
  totals: Pick<TaxReturnPreview, 'awaitingReview'> | null | undefined,
  question: { value: string },
): boolean {
  const waiting = totals?.awaitingReview ?? 0;
  return waiting === 0 || window.confirm(question.value.replace('{count}', String(waiting)));
}
