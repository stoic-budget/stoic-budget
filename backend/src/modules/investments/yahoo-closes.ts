import { Schema } from 'effect';

/** Quote currencies that are a hundredth of the real one: London in pence, Tel Aviv in agorot. */
export const HUNDREDTHS_OF: Record<string, string> = {
  GBp: 'GBP',
  GBX: 'GBP',
  ZAc: 'ZAR',
  ZAC: 'ZAR',
  ILA: 'ILS',
};

const Split = Schema.Struct({
  date: Schema.Number,
  numerator: Schema.Number,
  denominator: Schema.Number,
});

/** Yahoo's chart answer for a range of daily bars, with the splits inside it. */
export const YahooHistory = Schema.Struct({
  chart: Schema.Struct({
    result: Schema.NullOr(
      Schema.Array(
        Schema.Struct({
          meta: Schema.Struct({
            currency: Schema.optional(Schema.NullOr(Schema.String)),
            /** The exchange's offset from UTC in seconds: a bar's timestamp is its local open. */
            gmtoffset: Schema.optional(Schema.NullOr(Schema.Number)),
          }),
          timestamp: Schema.optional(Schema.NullOr(Schema.Array(Schema.Number))),
          events: Schema.optional(
            Schema.NullOr(
              Schema.Struct({
                splits: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Split))),
              }),
            ),
          ),
          indicators: Schema.Struct({
            quote: Schema.Array(
              Schema.Struct({
                close: Schema.optional(Schema.NullOr(Schema.Array(Schema.NullOr(Schema.Number)))),
              }),
            ),
          }),
        }),
      ),
    ),
  }),
});
export type YahooHistory = typeof YahooHistory.Type;

export interface DailyClose {
  date: string;
  close: number;
}

export interface FetchedCloses {
  currency: string;
  closes: DailyClose[];
}

/**
 * The bars of a chart answer as dated closes, the way they were quoted on the
 * day. Yahoo divides every close before a split by its ratio; that is undone
 * with the splits the same answer lists, so a close stored today does not
 * change meaning when the next split comes, and a close typed in from an old
 * statement means the same as the feed's. A bar's day is the exchange's local
 * day (a Sydney open is the previous evening in UTC). Days without a close are
 * left out; a day quoted twice keeps its last bar.
 */
export function readYahooCloses(chart: YahooHistory): FetchedCloses | null {
  const result = chart.chart.result?.[0];
  const quoted = result?.meta.currency;
  const stamps = result?.timestamp ?? [];
  const bars = result?.indicators.quote[0]?.close ?? [];
  if (!(result && quoted && stamps.length > 0)) return null;
  const offset = result.meta.gmtoffset ?? 0;
  const whole = HUNDREDTHS_OF[quoted];
  const splits = Object.values(result.events?.splits ?? {})
    .filter(split => split.numerator > 0 && split.denominator > 0)
    .map(split => ({
      date: localDay(split.date, offset),
      ratio: split.numerator / split.denominator,
    }));

  const byDate = new Map<string, number>();
  stamps.forEach((stamp, index) => {
    const close = bars[index];
    if (close === null || close === undefined || !(close > 0)) return;
    const date = localDay(stamp, offset);
    // Each split dated after the bar divided it; multiply back.
    const factor = splits
      .filter(split => split.date > date)
      .reduce((product, split) => product * split.ratio, 1);
    const stored = roundClose((close * factor) / (whole ? 100 : 1));
    if (stored > 0) byDate.set(date, stored);
  });
  if (byDate.size === 0) return null;
  return {
    currency: whole ?? quoted.toUpperCase(),
    closes: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, close]) => ({ date, close })),
  };
}

function localDay(stamp: number, offsetSeconds: number): string {
  return new Date((stamp + offsetSeconds) * 1000).toISOString().slice(0, 10);
}

/** As the column keeps it: eight decimals. */
function roundClose(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
