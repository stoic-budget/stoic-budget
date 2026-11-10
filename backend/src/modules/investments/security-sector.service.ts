import { Injectable, Logger } from '@nestjs/common';
import { Effect, Schema } from 'effect';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { describeHttpFailure, getJson } from '../../common/effect/http-json';
import { assertPublicEgressUrl } from '../../common/utils/egress-url.util';
import type { HoldingSector } from '../../contracts';
import { normalizeStockSymbol, yahooSymbol } from './stock-price.service';

const YahooSearch = Schema.Struct({
  quotes: Schema.optional(
    Schema.NullOr(
      Schema.Array(
        Schema.Struct({
          symbol: Schema.optional(Schema.NullOr(Schema.String)),
          sector: Schema.optional(Schema.NullOr(Schema.String)),
        }),
      ),
    ),
  ),
});

const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';

/**
 * Yahoo's sector names (Morningstar's words) and the GICS sector each one is.
 * A name not here is not guessed at: the suggestion comes back empty.
 */
export const YAHOO_SECTOR: Readonly<Record<string, HoldingSector>> = {
  Technology: 'information_technology',
  'Communication Services': 'communication_services',
  'Consumer Cyclical': 'consumer_discretionary',
  'Consumer Defensive': 'consumer_staples',
  Healthcare: 'health_care',
  'Financial Services': 'financials',
  Industrials: 'industrials',
  Energy: 'energy',
  Utilities: 'utilities',
  'Real Estate': 'real_estate',
  'Basic Materials': 'materials',
};

/**
 * A company's sector from Yahoo Finance's public search, the same free source
 * the prices come from. Only a share has one; an ETF or a fund answers
 * nothing, and its breakdown stays the user's to type. Asked once, on request,
 * never stored on its own: the user sees the suggestion and saves it.
 */
@Injectable()
export class SecuritySectorService {
  private readonly logger = new Logger(SecuritySectorService.name);

  constructor(private readonly effects: EffectRuntime) {}

  async sectorOf(symbol: string): Promise<HoldingSector | null> {
    const wanted = yahooSymbol(normalizeStockSymbol(symbol));
    const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(wanted)}&quotesCount=5&newsCount=0&listsCount=0`;
    const logger = this.logger;
    try {
      await assertPublicEgressUrl(url);
    } catch (error) {
      logger.warn(`Yahoo search refused: ${String(error)}`);
      return null;
    }
    const answer = await this.effects.run(
      getJson(url, YahooSearch, { timeout: '10 seconds' }).pipe(
        Effect.catch(error =>
          Effect.sync(() => {
            logger.warn(`Yahoo sector for ${wanted} failed: ${describeHttpFailure(error)}`);
            return null;
          }),
        ),
      ),
    );
    // Only the exact symbol counts: a search also answers with look-alikes.
    const quote = answer?.quotes?.find(item => item.symbol?.toUpperCase() === wanted.toUpperCase());
    return (quote?.sector && YAHOO_SECTOR[quote.sector]) || null;
  }
}
