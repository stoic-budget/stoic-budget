import type { BalanceAccount, BalanceSnapshot } from '../../entities';
import { depreciatedValue } from '../balance/property/property-math';
import { isoDate, latestOnOrBefore } from '../balance/snapshot-series';
import {
  type CurrencyConverter,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { type ComputedLines, computedValue } from './computed-lines';
import { toNumber } from './net-worth-math';

type Snapshot = Pick<BalanceSnapshot, 'accountId' | 'snapshotDate' | 'amount' | 'currency'>;

/** What a snapshot line is worth on a day, in the currency it was entered in. */
export interface Valuation {
  amount: number;
  currency: string;
  /** The day of the value someone entered, which the amount starts from. */
  valuedOn: string;
  /** True when the amount is that value depreciated to the day, not the value itself. */
  estimated: boolean;
}

/**
 * How every line of the sheet is read on a day. Computed lines (cash, the
 * accounts' debts) come from the books; every other line holds its last
 * entered value until the next one — or, for a line that depreciates, that
 * value less what it lost since. The estimate is worked out on every read and
 * never written back, so a past day keeps the valuation it had and a new
 * valuation simply starts the decline again from itself.
 */
export function valueReaders(input: {
  accounts: BalanceAccount[];
  snapshotsByAccount: Map<string, Snapshot[]>;
  computedByCode: ComputedLines;
  converter: CurrencyConverter;
  currency: string;
}) {
  const { snapshotsByAccount, computedByCode, converter, currency } = input;
  const rates = new Map(
    input.accounts
      .filter(account => Number(account.depreciationRate) > 0)
      .map(account => [account.id, Number(account.depreciationRate)]),
  );

  const valuation = (accountId: string, date: string): Valuation | null => {
    const snapshot = latestOnOrBefore(snapshotsByAccount.get(accountId), date);
    if (!snapshot) return null;
    const valuedOn = isoDate(new Date(snapshot.snapshotDate));
    const entered = toNumber(snapshot.amount);
    const rate = rates.get(accountId);
    return {
      amount: rate ? depreciatedValue(entered, rate, valuedOn, date) : entered,
      currency: normalizeCurrencyCode(snapshot.currency || currency),
      valuedOn,
      estimated: rate !== undefined && date > valuedOn,
    };
  };

  /** A line's value on `date` in the workspace currency. */
  const valueAt = (accountId: string, code: string, date: string): number => {
    const computed = computedValue(computedByCode, converter, code, date);
    if (computed !== null) return computed;
    const value = valuation(accountId, date);
    return value ? converter.convert(value.amount, value.currency, date) : 0;
  };

  /** What the line holds on a day, in the currency it is held in. */
  const nativeAt = (leaf: BalanceAccount, date: string): Map<string, number> => {
    const computed = computedByCode.get(leaf.code);
    if (computed) return computed.get(date) ?? new Map();
    const value = valuation(leaf.id, date);
    return value ? new Map([[value.currency, value.amount]]) : new Map();
  };

  return { valuation, valueAt, nativeAt };
}
