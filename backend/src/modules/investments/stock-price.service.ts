import { Injectable, Logger } from '@nestjs/common';
import { Effect, Schema } from 'effect';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { describeHttpFailure, getJson } from '../../common/effect/http-json';
import { assertPublicEgressUrl } from '../../common/utils/egress-url.util';
import { type FetchedCloses, HUNDREDTHS_OF, readYahooCloses, YahooHistory } from './yahoo-closes';

export interface QuotedPrice {
  symbol: string;
  price: number;
  currency: string;
  at: Date;
}

/** `AAPL` → `AAPL.US`; a symbol that already names its market is kept. */
export function normalizeStockSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  return trimmed.includes('.') ? trimmed : `${trimmed}.US`;
}

/** Market suffixes people already hold in their positions, and what Yahoo calls those markets. */
const YAHOO_SUFFIX: Record<string, string> = {
  US: '',
  UK: '.L',
  FR: '.PA',
  NL: '.AS',
  IT: '.MI',
  ES: '.MC',
  PL: '.WA',
  JP: '.T',
  CA: '.TO',
  AU: '.AX',
  CH: '.SW',
  SE: '.ST',
  NO: '.OL',
  DK: '.CO',
  TR: '.IS',
};

/** `AAPL.US` → `AAPL`, `VOD.UK` → `VOD.L`; a suffix Yahoo already uses passes through. */
export function yahooSymbol(symbol: string): string {
  const dot = symbol.lastIndexOf('.');
  const suffix = YAHOO_SUFFIX[symbol.slice(dot + 1)];
  return suffix === undefined ? symbol : `${symbol.slice(0, dot)}${suffix}`;
}

const YahooChart = Schema.Struct({
  chart: Schema.Struct({
    result: Schema.NullOr(
      Schema.Array(
        Schema.Struct({
          meta: Schema.Struct({
            regularMarketPrice: Schema.optional(Schema.NullOr(Schema.Number)),
            currency: Schema.optional(Schema.NullOr(Schema.String)),
          }),
        }),
      ),
    ),
  }),
});

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const CACHE_TTL_MS = 15 * 60 * 1000;
/** Yahoo quotes one symbol per request. */
const CONCURRENT_QUOTES = 5;

/**
 * Prices from Yahoo Finance's public chart endpoint, a free source that needs no
 * key. Quotes are cached for fifteen minutes; the host is checked against the
 * egress guard like every other outbound call. A price that cannot be fetched is
 * simply absent, and the holding keeps the one it had.
 */
@Injectable()
export class StockPriceService {
  private readonly logger = new Logger(StockPriceService.name);
  private readonly cache = new Map<string, QuotedPrice>();

  constructor(private readonly effects: EffectRuntime) {}

  async getPrices(symbols: string[]): Promise<Map<string, QuotedPrice>> {
    const wanted = [...new Set(symbols.map(normalizeStockSymbol))];
    const result = new Map<string, QuotedPrice>();
    const stale: string[] = [];
    const now = Date.now();
    for (const symbol of wanted) {
      const cached = this.cache.get(symbol);
      if (cached && now - cached.at.getTime() < CACHE_TTL_MS) {
        result.set(symbol, cached);
      } else {
        stale.push(symbol);
      }
    }
    for (let offset = 0; offset < stale.length; offset += CONCURRENT_QUOTES) {
      const quotes = await Promise.all(
        stale.slice(offset, offset + CONCURRENT_QUOTES).map(symbol => this.quote(symbol)),
      );
      for (const quote of quotes) {
        if (!quote) continue;
        this.cache.set(quote.symbol, quote);
        result.set(quote.symbol, quote);
      }
    }
    return result;
  }

  /**
   * A symbol's daily closes over `range` (`1mo` for the daily job, `10y` for
   * a first backfill: about 2,500 bars), or null (logged) when Yahoo refused,
   * has none or could not be reached. Not cached: the caller stores them.
   */
  async fetchDailyCloses(symbol: string, range: '1mo' | '10y'): Promise<FetchedCloses | null> {
    const name = encodeURIComponent(yahooSymbol(normalizeStockSymbol(symbol)));
    const url = `${YAHOO_CHART_URL}${name}?range=${range}&interval=1d&events=split`;
    const logger = this.logger;
    try {
      await assertPublicEgressUrl(url);
    } catch (error) {
      logger.warn(`Yahoo history failed: ${String(error)}`);
      return null;
    }
    const chart = await this.effects.run(
      getJson(url, YahooHistory, { timeout: '20 seconds' }).pipe(
        Effect.catch(error =>
          Effect.sync(() => {
            logger.warn(`Yahoo history for ${symbol} failed: ${describeHttpFailure(error)}`);
            return null;
          }),
        ),
      ),
    );
    return chart ? readYahooCloses(chart) : null;
  }

  /** One symbol's quote, or null (logged) when Yahoo refused, has no price or could not be reached. */
  private async quote(symbol: string): Promise<QuotedPrice | null> {
    const url = `${YAHOO_CHART_URL}${encodeURIComponent(yahooSymbol(symbol))}?range=1d&interval=1d`;
    const logger = this.logger;
    try {
      await assertPublicEgressUrl(url);
    } catch (error) {
      logger.warn(`Yahoo quote failed: ${String(error)}`);
      return null;
    }
    const chart = await this.effects.run(
      getJson(url, YahooChart, { timeout: '10 seconds' }).pipe(
        Effect.catch(error =>
          Effect.sync(() => {
            logger.warn(`Yahoo quote for ${symbol} failed: ${describeHttpFailure(error)}`);
            return null;
          }),
        ),
      ),
    );
    const meta = chart?.chart.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const currency = meta?.currency;
    if (!(price && price > 0 && currency)) return null;
    const whole = HUNDREDTHS_OF[currency];
    return {
      symbol,
      price: whole ? price / 100 : price,
      currency: whole ?? currency.toUpperCase(),
      at: new Date(),
    };
  }
}
