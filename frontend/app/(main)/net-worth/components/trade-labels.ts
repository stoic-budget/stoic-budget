import type { InvestmentTradeKind } from '../hooks/useInvestmentTrades';

/** The content key naming each kind of trade. */
export const KIND_KEYS = {
  buy: 'kindBuy',
  sell: 'kindSell',
  dividend: 'kindDividend',
  split: 'kindSplit',
  transfer_in: 'kindTransferIn',
  transfer_out: 'kindTransferOut',
} as const satisfies Record<InvestmentTradeKind, string>;

/** "3 for 1", with the numbers in the reader's format. */
export function ratioText(to: number | null, from: number | null, locale: string): string {
  const format = (value: number | null) => new Intl.NumberFormat(locale).format(value ?? 0);
  return `${format(to)}:${format(from)}`;
}

export function formatUnits(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(value);
}
