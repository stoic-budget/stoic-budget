'use client';

import type React from 'react';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';

interface Totals {
  subtotal: number;
  taxTotal: number;
  total: number;
}

/**
 * The totals a saved invoice was issued with, as the server stored them: the
 * document and the client's debt carry these, so the page shows them rather
 * than adding the lines up again in the browser (#684).
 */
export function savedTotals(invoice: {
  subtotal: string | number;
  taxTotal: string | number;
  total: string | number;
}): Totals {
  return {
    subtotal: Number(invoice.subtotal),
    taxTotal: Number(invoice.taxTotal),
    total: Number(invoice.total),
  };
}

/** Subtotal, tax and total lines under an invoice's items. */
export function InvoiceTotalLines({
  totals,
  currency,
  locale,
}: {
  totals: Totals;
  currency: string;
  locale: string;
}): React.ReactElement {
  const t = useIntlayer('invoicesPage');
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span>{t.detail.subtotal.value}</span>
        <span className={PRIVATE_CLASS}>{formatMoney(totals.subtotal, currency, locale)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span>{t.detail.tax.value}</span>
        <span className={PRIVATE_CLASS}>{formatMoney(totals.taxTotal, currency, locale)}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        <span>{t.columns.total.value}</span>
        <span className={PRIVATE_CLASS}>{formatMoney(totals.total, currency, locale)}</span>
      </div>
    </>
  );
}
