import {
  addLot,
  daysBetween,
  heldCost,
  heldQuantity,
  LOT_EPSILON,
  type Lot,
  type LotMethod,
  splitLots,
  takeFromLots,
} from '../../common/lots/lot-book';

/**
 * A holding's trades replayed into lots: what is held, what it cost, and what
 * every sale realised. Pure, so the rules can be read and tested apart from
 * the database:
 * - a buy's fee is part of what the shares cost; a sale's fee comes off what
 *   it fetched;
 * - a transfer in carries the basis and the acquisition date it is given; a
 *   transfer out takes lots away without realising anything, and its fee is a
 *   realised cost, since nothing else will ever carry it;
 * - a split changes how many units each lot holds, never what it cost;
 * - a dividend is income on the holding, net of the tax or fee held back.
 * Selling or moving out more than is held is refused, not booked as a gain
 * from nothing.
 */

export type TradeKind = 'buy' | 'sell' | 'dividend' | 'split' | 'transfer_in' | 'transfer_out';

export interface TradeEvent {
  id: string;
  kind: TradeKind;
  date: string;
  quantity: number;
  price: number;
  fee: number;
  /** Dividend only: the cash it paid, before `fee`. */
  amount: number | null;
  /** Split only: `splitTo` new units for every `splitFrom` old ones. */
  splitFrom: number | null;
  splitTo: number | null;
  /** Transfer in only: when the units were first bought; the trade date when null. */
  acquiredOn: string | null;
}

export interface OpenLotView {
  tradeId: string;
  acquiredOn: string;
  quantity: number;
  unitCost: number;
  cost: number;
}

export interface TradeSaleView {
  tradeId: string;
  date: string;
  quantity: number;
  proceeds: number;
  fee: number;
  cost: number;
  gain: number;
  acquiredOn: string | null;
  heldDays: number | null;
}

export interface TradeYear {
  year: number;
  realizedGain: number;
  dividends: number;
}

export interface TradeLedger {
  method: LotMethod;
  quantity: number;
  costBasis: number;
  averageCost: number | null;
  openLots: OpenLotView[];
  sales: TradeSaleView[];
  realizedGain: number;
  dividends: number;
  fees: number;
  years: TradeYear[];
}

/**
 * Whether the trades say how many units are held. A dividend does not: a
 * holding with only dividends behind it keeps the quantity typed in for it.
 */
export function countsUnits(trades: ReadonlyArray<Pick<TradeEvent, 'kind'>>): boolean {
  return trades.some(trade => trade.kind !== 'dividend');
}

/** A trade the history cannot carry: it sells or moves out more than is held. */
export class TradeReplayError extends Error {
  constructor(readonly tradeId: string) {
    super(`Trade ${tradeId} takes out more than the holding has`);
  }
}

/**
 * Within one day a split comes first (a buy on the split day is already in
 * new units), then what comes in, then income, then what goes out: a sale
 * entered before the buy of the same day is still covered by it.
 */
const DAY_ORDER: Record<TradeKind, number> = {
  split: 0,
  transfer_in: 1,
  buy: 2,
  dividend: 3,
  sell: 4,
  transfer_out: 5,
};

/** By date, then by the order above, then in the order given. */
export function orderTrades<T extends Pick<TradeEvent, 'date' | 'kind'>>(trades: T[]): T[] {
  return trades
    .map((trade, index) => ({ trade, index }))
    .sort(
      (a, b) =>
        a.trade.date.localeCompare(b.trade.date) ||
        DAY_ORDER[a.trade.kind] - DAY_ORDER[b.trade.kind] ||
        a.index - b.index,
    )
    .map(entry => entry.trade);
}

export function replayTrades(trades: TradeEvent[], method: LotMethod): TradeLedger {
  const lots: Lot[] = [];
  const sales: TradeSaleView[] = [];
  const years = new Map<number, TradeYear>();
  const year = (date: string): TradeYear => {
    const key = Number(date.slice(0, 4));
    const entry = years.get(key) ?? { year: key, realizedGain: 0, dividends: 0 };
    years.set(key, entry);
    return entry;
  };
  let realized = 0;
  let dividends = 0;
  let fees = 0;

  for (const trade of orderTrades(trades)) {
    fees += trade.fee;
    switch (trade.kind) {
      case 'buy':
      case 'transfer_in': {
        const cost = trade.quantity * trade.price + trade.fee;
        addLot(lots, {
          quantity: trade.quantity,
          unitCost: cost / trade.quantity,
          date: (trade.kind === 'transfer_in' && trade.acquiredOn) || trade.date,
          ref: trade.id,
        });
        break;
      }
      case 'sell':
      case 'transfer_out': {
        if (trade.quantity > heldQuantity(lots) + LOT_EPSILON) {
          throw new TradeReplayError(trade.id);
        }
        const taken = takeFromLots(lots, trade.quantity, method, LOT_EPSILON);
        if (trade.kind === 'transfer_out') {
          realized -= trade.fee;
          year(trade.date).realizedGain -= trade.fee;
          break;
        }
        const proceeds = trade.quantity * trade.price - trade.fee;
        const gain = proceeds - taken.cost;
        realized += gain;
        year(trade.date).realizedGain += gain;
        sales.push({
          tradeId: trade.id,
          date: trade.date,
          quantity: round(trade.quantity, 8),
          proceeds: round(proceeds, 2),
          fee: round(trade.fee, 2),
          cost: round(taken.cost, 2),
          gain: round(gain, 2),
          acquiredOn: taken.oldest,
          heldDays: taken.oldest ? daysBetween(taken.oldest, trade.date) : null,
        });
        break;
      }
      case 'split': {
        if (trade.splitFrom && trade.splitTo) {
          splitLots(lots, trade.splitTo / trade.splitFrom);
        }
        break;
      }
      case 'dividend': {
        const income = (trade.amount ?? 0) - trade.fee;
        dividends += income;
        year(trade.date).dividends += income;
        break;
      }
    }
  }

  const quantity = heldQuantity(lots);
  const cost = heldCost(lots);
  return {
    method,
    quantity: round(quantity, 8),
    costBasis: round(cost, 2),
    averageCost: quantity > LOT_EPSILON ? round(cost / quantity, 6) : null,
    openLots: lots.map(lot => ({
      tradeId: lot.ref ?? '',
      acquiredOn: lot.date,
      quantity: round(lot.quantity, 8),
      unitCost: round(lot.unitCost, 6),
      cost: round(lot.quantity * lot.unitCost, 2),
    })),
    sales,
    realizedGain: round(realized, 2),
    dividends: round(dividends, 2),
    fees: round(fees, 2),
    years: [...years.values()]
      .sort((a, b) => a.year - b.year)
      .map(entry => ({
        year: entry.year,
        realizedGain: round(entry.realizedGain, 2),
        dividends: round(entry.dividends, 2),
      })),
  };
}

/**
 * How many units each unit quoted on `pricedOn` has become through the splits
 * dated after it. A price typed in before a 2-for-1 split is a price for one
 * old share, two new ones: the holding's price follows the splits recorded
 * after its quote, and a refreshed quote starts again at 1.
 */
export function splitFactorSince(trades: TradeEvent[], pricedOn: string | null): number {
  return trades
    .filter(trade => trade.kind === 'split' && trade.splitFrom && trade.splitTo)
    .filter(trade => pricedOn === null || trade.date > pricedOn)
    .reduce(
      (factor, trade) => (factor * (trade.splitTo as number)) / (trade.splitFrom as number),
      1,
    );
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
