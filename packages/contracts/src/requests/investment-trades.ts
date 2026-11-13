import * as Schema from 'effect/Schema';
import { DateOnlyInput, NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

const Kind = Schema.Literals(['buy', 'sell', 'dividend', 'split', 'transfer_in', 'transfer_out']);
const NonNegative = NumericInput.check(Schema.isGreaterThanOrEqualTo(0));
const Positive = NumericInput.check(Schema.isGreaterThan(0));

/**
 * The fields of a trade. Which ones a kind needs is checked in the service: a
 * buy, sell or transfer needs a quantity, a dividend an amount, a split both
 * sides of its ratio.
 */
const tradeFields = {
  quantity: optionalNullable(NonNegative),
  price: optionalNullable(NonNegative),
  fee: optionalNullable(NonNegative),
  amount: optionalNullable(NonNegative),
  /** Defaults to the currency of the holding's other trades, then of its price. */
  // 3–10 characters once trimmed, as it is stored (and as the form checks it).
  currency: optionalNullable(Schema.String.check(Schema.isPattern(/^\s*\S[\s\S]{1,8}\S\s*$/))),
  splitFrom: optionalNullable(Positive),
  splitTo: optionalNullable(Positive),
  acquiredOn: optionalNullable(DateOnlyInput),
  /** The cash leg; looked up in the caller's workspace. Null unlinks it. */
  transactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
  note: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
};

/** `POST /investments/holdings/:id/trades`. */
export const CreateInvestmentTradeBody = Schema.Struct({
  kind: Kind,
  date: DateOnlyInput,
  ...tradeFields,
});
export type CreateInvestmentTradeBody = Wire<typeof CreateInvestmentTradeBody>;

/** `PATCH /investments/trades/:id`: only what is sent changes. */
export const UpdateInvestmentTradeBody = Schema.Struct({
  kind: optionalNullable(Kind),
  date: optionalNullable(DateOnlyInput),
  ...tradeFields,
});
export type UpdateInvestmentTradeBody = Wire<typeof UpdateInvestmentTradeBody>;

/** `PATCH /investments/settings`. */
export const InvestmentSettingsBody = Schema.Struct({
  basisMethod: Schema.Literals(['fifo', 'average']),
});
export type InvestmentSettingsBody = Wire<typeof InvestmentSettingsBody>;
