import type {
  InvestmentTrade,
  InvestmentTradeKind,
  TradeInput,
} from '../hooks/useInvestmentTrades';

/** The kinds the trade form enters; a split has its own dialog. */
export const FORM_KINDS = ['buy', 'sell', 'dividend', 'transfer_in', 'transfer_out'] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export interface TradeFormState {
  kind: FormKind;
  date: string;
  quantity: string;
  price: string;
  fee: string;
  amount: string;
  acquiredOn: string;
  currency: string;
  note: string;
}

export type TradeFormError =
  | 'invalidDate'
  | 'invalidQuantity'
  | 'invalidNumber'
  | 'invalidAmount'
  | 'invalidCurrency'
  | 'noteTooLong';

/** Mirrors the contract: notes up to 500 characters, currencies of 3 to 10. */
const NOTE_MAX = 500;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** What each kind shows, and so what the form sends: nothing it does not show. */
export function fieldsOf(kind: FormKind) {
  return {
    units: kind !== 'dividend',
    amount: kind === 'dividend',
    acquiredOn: kind === 'transfer_in',
  };
}

export function emptyForm(currency: string, today: string): TradeFormState {
  return {
    kind: 'buy',
    date: today,
    quantity: '',
    price: '',
    fee: '',
    amount: '',
    acquiredOn: '',
    currency,
    note: '',
  };
}

export function formFromTrade(trade: InvestmentTrade): TradeFormState {
  const text = (value: number | null) => (value === null || value === 0 ? '' : String(value));
  return {
    kind: (FORM_KINDS as readonly InvestmentTradeKind[]).includes(trade.kind)
      ? (trade.kind as FormKind)
      : 'buy',
    date: trade.date,
    quantity: text(trade.quantity),
    price: text(trade.price),
    fee: text(trade.fee),
    amount: text(trade.amount),
    acquiredOn: trade.acquiredOn ?? '',
    currency: trade.currency,
    note: trade.note ?? '',
  };
}

/** "1 234,5" and "1234.5" both; blank is null; anything else NaN. */
export function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!text) return null;
  return /^\d*\.?\d+$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * The body the form sends, or the first thing wrong with it. The same rules
 * the server holds: a buy, sale or transfer needs a quantity above zero, a
 * dividend an amount above zero, every other number zero or more.
 */
export function buildTrade(form: TradeFormState): TradeInput | { error: TradeFormError } {
  if (!DATE.test(form.date)) return { error: 'invalidDate' };
  const shown = fieldsOf(form.kind);
  const fee = parseDecimal(form.fee) ?? 0;
  if (!(fee >= 0)) return { error: 'invalidNumber' };
  const currency = form.currency.trim().toUpperCase();
  if (currency.length < 3 || currency.length > 10) return { error: 'invalidCurrency' };
  if (form.note.length > NOTE_MAX) return { error: 'noteTooLong' };
  const base = { kind: form.kind, date: form.date, fee, currency, note: form.note.trim() || null };
  if (shown.amount) {
    const amount = parseDecimal(form.amount);
    if (amount === null || !(amount > 0)) return { error: 'invalidAmount' };
    return { ...base, amount };
  }
  const quantity = parseDecimal(form.quantity);
  if (quantity === null || !(quantity > 0)) return { error: 'invalidQuantity' };
  const price = parseDecimal(form.price) ?? 0;
  if (!(price >= 0)) return { error: 'invalidNumber' };
  if (shown.acquiredOn && form.acquiredOn && !DATE.test(form.acquiredOn)) {
    return { error: 'invalidDate' };
  }
  return {
    ...base,
    quantity,
    price,
    ...(shown.acquiredOn ? { acquiredOn: form.acquiredOn || null } : {}),
  };
}
