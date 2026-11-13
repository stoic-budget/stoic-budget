import * as Schema from 'effect/Schema';
import { DateOnly, Timestamp, type Wire } from '../common/wire';

export const InvestmentTradeKind = Schema.Literals([
  'buy',
  'sell',
  'dividend',
  'split',
  'transfer_in',
  'transfer_out',
]);
export type InvestmentTradeKind = Wire<typeof InvestmentTradeKind>;

/** How a sale is matched to the lots it came from. */
export const CostBasisMethod = Schema.Literals(['fifo', 'average']);
export type CostBasisMethod = Wire<typeof CostBasisMethod>;

/** One trade of a holding; also the answer of its create and update. */
export const InvestmentTrade = Schema.Struct({
  id: Schema.String,
  holdingId: Schema.String,
  kind: InvestmentTradeKind,
  date: DateOnly,
  quantity: Schema.Number,
  price: Schema.Number,
  fee: Schema.Number,
  /** Dividend only: the cash it paid, before `fee`. */
  amount: Schema.NullOr(Schema.Number),
  currency: Schema.String,
  /** Split only: `splitTo` new units for every `splitFrom` old ones. */
  splitFrom: Schema.NullOr(Schema.Number),
  splitTo: Schema.NullOr(Schema.Number),
  /** Transfer in only: when the units were first bought. */
  acquiredOn: Schema.NullOr(DateOnly),
  /** The cash leg, when linked. */
  transactionId: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
});
export type InvestmentTrade = Wire<typeof InvestmentTrade>;

/** `GET /investments/holdings/:id/trades`, oldest first. */
export const InvestmentTradeList = Schema.Array(InvestmentTrade);
export type InvestmentTradeList = Wire<typeof InvestmentTradeList>;

/**
 * `GET /investments/holdings/:id/lots`: the trades replayed into lots. Money is
 * in `currency`, the currency the trades were entered in; `null` with no trades.
 */
export const HoldingLots = Schema.Struct({
  holdingId: Schema.String,
  method: CostBasisMethod,
  currency: Schema.NullOr(Schema.String),
  quantity: Schema.Number,
  costBasis: Schema.Number,
  averageCost: Schema.NullOr(Schema.Number),
  /** Quantity at the holding's price; null without an exchange rate to `currency`. */
  marketValue: Schema.NullOr(Schema.Number),
  /** Null also when only dividends are recorded: what the units cost is unknown. */
  unrealizedGain: Schema.NullOr(Schema.Number),
  realizedGain: Schema.Number,
  /** Net of the tax or fee held back. */
  dividends: Schema.Number,
  fees: Schema.Number,
  openLots: Schema.Array(
    Schema.Struct({
      tradeId: Schema.String,
      acquiredOn: DateOnly,
      quantity: Schema.Number,
      unitCost: Schema.Number,
      cost: Schema.Number,
    }),
  ),
  sales: Schema.Array(
    Schema.Struct({
      tradeId: Schema.String,
      date: DateOnly,
      quantity: Schema.Number,
      proceeds: Schema.Number,
      fee: Schema.Number,
      cost: Schema.Number,
      gain: Schema.Number,
      acquiredOn: Schema.NullOr(DateOnly),
      heldDays: Schema.NullOr(Schema.Number),
    }),
  ),
  years: Schema.Array(
    Schema.Struct({
      year: Schema.Number,
      realizedGain: Schema.Number,
      dividends: Schema.Number,
    }),
  ),
});
export type HoldingLots = Wire<typeof HoldingLots>;

/** `GET` and `PATCH /investments/settings`. */
export const InvestmentSettings = Schema.Struct({
  basisMethod: CostBasisMethod,
});
export type InvestmentSettings = Wire<typeof InvestmentSettings>;
