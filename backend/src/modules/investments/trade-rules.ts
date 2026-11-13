import { BadRequestException } from '@nestjs/common';
import { appError } from '../../common/errors/app-error';
import type { InvestmentTrade as TradeView, UpdateInvestmentTradeBody } from '../../contracts';
import type { InvestmentHolding } from '../../entities/investment-holding.entity';
import type { InvestmentTrade, InvestmentTradeKind } from '../../entities/investment-trade.entity';
import type { TradeEvent, TradeKind } from './trade-ledger';

/** A trade's fields before they are stored: what the API and the import both build. */
export interface TradeDraft {
  kind: TradeKind;
  date: string;
  quantity: number;
  price: number;
  fee: number;
  amount: number | null;
  splitFrom: number | null;
  splitTo: number | null;
  acquiredOn: string | null;
}

export type TradeRuleError =
  | 'INVESTMENTS_TRADE_QUANTITY_REQUIRED'
  | 'INVESTMENTS_TRADE_AMOUNT_REQUIRED'
  | 'INVESTMENTS_TRADE_RATIO_REQUIRED';

/**
 * Keeps the fields the kind uses and clears the rest, the same rule the
 * table's CHECK constraints hold: a dividend is an amount, a split a ratio,
 * everything else a quantity above zero at a price. A kind changed on an edit
 * therefore never carries a stale field of the old kind into the row.
 */
export function normalizeTrade(draft: TradeDraft): TradeDraft | { error: TradeRuleError } {
  const base = { kind: draft.kind, date: draft.date, amount: null, splitFrom: null, splitTo: null };
  switch (draft.kind) {
    case 'dividend':
      if (draft.amount === null || !(draft.amount > 0)) {
        return { error: 'INVESTMENTS_TRADE_AMOUNT_REQUIRED' };
      }
      return {
        ...base,
        quantity: 0,
        price: 0,
        fee: draft.fee,
        amount: draft.amount,
        acquiredOn: null,
      };
    case 'split':
      if (!(draft.splitFrom && draft.splitFrom > 0 && draft.splitTo && draft.splitTo > 0)) {
        return { error: 'INVESTMENTS_TRADE_RATIO_REQUIRED' };
      }
      return {
        ...base,
        quantity: 0,
        price: 0,
        fee: 0,
        splitFrom: draft.splitFrom,
        splitTo: draft.splitTo,
        acquiredOn: null,
      };
    default:
      if (!(draft.quantity > 0)) {
        return { error: 'INVESTMENTS_TRADE_QUANTITY_REQUIRED' };
      }
      return {
        ...base,
        quantity: draft.quantity,
        price: draft.price,
        fee: draft.fee,
        acquiredOn: draft.kind === 'transfer_in' ? draft.acquiredOn : null,
      };
  }
}

const orNull = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

/** A stored row as the lot engine reads it; decimal columns arrive as strings. */
export function toTradeEvent(trade: InvestmentTrade): TradeEvent {
  return {
    id: trade.id,
    kind: trade.kind,
    date: String(trade.tradeDate).slice(0, 10),
    quantity: Number(trade.quantity),
    price: Number(trade.price),
    fee: Number(trade.fee),
    amount: orNull(trade.amount),
    splitFrom: orNull(trade.splitFrom),
    splitTo: orNull(trade.splitTo),
    acquiredOn: trade.acquiredOn ? String(trade.acquiredOn).slice(0, 10) : null,
  };
}

export function toTradeView(trade: InvestmentTrade): TradeView {
  const event = toTradeEvent(trade);
  return {
    id: trade.id,
    holdingId: trade.holdingId,
    kind: event.kind,
    date: event.date,
    quantity: event.quantity,
    price: event.price,
    fee: event.fee,
    amount: event.amount,
    currency: trade.currency,
    splitFrom: event.splitFrom,
    splitTo: event.splitTo,
    acquiredOn: event.acquiredOn,
    transactionId: trade.transactionId,
    note: trade.note,
    createdAt: new Date(trade.createdAt).toISOString(),
  };
}

/** Rows as they were entered, which is how the engine breaks a tie within a day. */
export const ENTRY_ORDER = { createdAt: 'ASC', id: 'ASC' } as const;

/** The day the holding's price was quoted for; null when it never was. */
export function pricedOn(holding: Pick<InvestmentHolding, 'pricedAt'>): string | null {
  return holding.pricedAt ? new Date(holding.pricedAt).toISOString().slice(0, 10) : null;
}

/**
 * Writes a create or update body onto `trade`, the fields left out keeping
 * what it had (nothing, for a new one). The kind's rules apply to the result,
 * and a holding keeps one currency: `fixed` is the one its other trades use.
 * The cash leg is the caller's to look up.
 */
export function applyTradeBody(
  trade: InvestmentTrade,
  body: UpdateInvestmentTradeBody,
  defaultCurrency: string,
  fixed: string | undefined,
): void {
  const kept = (value: number | string | null | undefined) =>
    value === null || value === undefined ? null : Number(value);
  const normalized = normalizeTrade({
    kind: body.kind ?? trade.kind,
    date: body.date ?? String(trade.tradeDate).slice(0, 10),
    quantity: body.quantity ?? Number(trade.quantity ?? 0),
    price: body.price ?? Number(trade.price ?? 0),
    fee: body.fee ?? Number(trade.fee ?? 0),
    amount: body.amount !== undefined ? body.amount : kept(trade.amount),
    splitFrom: body.splitFrom !== undefined ? body.splitFrom : kept(trade.splitFrom),
    splitTo: body.splitTo !== undefined ? body.splitTo : kept(trade.splitTo),
    acquiredOn: body.acquiredOn !== undefined ? body.acquiredOn : (trade.acquiredOn ?? null),
  });
  if ('error' in normalized) throw new BadRequestException(appError(normalized.error));
  const currency = (body.currency ?? trade.currency ?? defaultCurrency).trim().toUpperCase();
  if (fixed && fixed !== currency) {
    throw new BadRequestException(
      appError('INVESTMENTS_TRADE_CURRENCY_MISMATCH', { currency: fixed }),
    );
  }
  Object.assign(trade, {
    kind: normalized.kind as InvestmentTradeKind,
    tradeDate: normalized.date,
    quantity: normalized.quantity,
    price: normalized.price,
    fee: normalized.fee,
    amount: normalized.amount,
    splitFrom: normalized.splitFrom,
    splitTo: normalized.splitTo,
    acquiredOn: normalized.acquiredOn,
    currency,
  });
  if (body.note !== undefined) trade.note = body.note?.trim() || null;
}
