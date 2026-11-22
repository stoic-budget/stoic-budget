import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { HoldingPriceHistory } from '../../contracts';
import { InvestmentHolding, InvestmentPriceSource } from '../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../entities/investment-trade.entity';
import { decimate, everyDay, isoDate } from '../balance/snapshot-series';
import { CurrencyConverter } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { InvestmentSettingsService } from './investment-settings.service';
import {
  type Convert,
  type DatedClose,
  holdingSeries,
  type LedgerState,
  ledgerStates,
  mergeCloses,
  pricedValueOn,
} from './price-history';
import { SecurityPricesService } from './security-prices.service';
import { countsUnits } from './trade-ledger';
import { ENTRY_ORDER, toTradeEvent } from './trade-rules';

const MAX_POINTS = 250;

/**
 * A holding's value over time from its daily closes: with trades, what was
 * held each day at that day's close against what it cost; without, only the
 * closes. Also what whole accounts were worth on days before anyone wrote
 * their balance down, for the returns page.
 */
@Injectable()
export class HoldingHistoryService {
  private readonly logger = new Logger(HoldingHistoryService.name);

  constructor(
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    @InjectRepository(InvestmentTrade)
    private readonly tradeRepository: Repository<InvestmentTrade>,
    private readonly prices: SecurityPricesService,
    private readonly settings: InvestmentSettingsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async history(workspaceId: string, holdingId: string): Promise<HoldingPriceHistory> {
    const holding = await this.holdingRepository.findOne({ where: { id: holdingId, workspaceId } });
    if (!holding) throw new NotFoundException(appError('INVESTMENTS_HOLDING_NOT_FOUND'));
    const trades = await this.tradeRepository.find({
      where: { workspaceId, holdingId },
      order: ENTRY_ORDER,
    });
    const symbol = holding.symbol;
    if (symbol) await this.backfill(symbol);
    const stored = symbol
      ? ((await this.prices.closesFor(workspaceId, [symbol])).get(symbol) ?? [])
      : [];
    const health = symbol
      ? ((await this.prices.healthFor(workspaceId, [symbol])).get(symbol) ?? null)
      : null;
    const today = isoDate(new Date());
    const closes = withToday(stored, holding, today);

    const traded = countsUnits(trades);
    const states = traded
      ? ledgerStates(trades.map(toTradeEvent), await this.settings.basisMethod(workspaceId))
      : null;
    const currency = traded ? trades[0].currency : holding.priceCurrency;
    const start = states?.[0]?.date ?? closes[0]?.date ?? today;
    const days = everyDay(start <= today ? start : today, today);
    const convert = await this.converter(workspaceId, currency, closes, days);
    const points = holdingSeries({ days, closes, states, convert });
    return {
      holdingId,
      symbol,
      currency,
      basis: states ? 'trades' : 'none',
      health,
      firstCloseOn: stored[0]?.date ?? null,
      points: decimateBy(points, point => (states ? point.value : point.close)),
    };
  }

  /**
   * What each account was worth on a day, from its holdings' trades and
   * closes; null for an account with a holding whose past quantity nobody
   * recorded (no trades) or a day a held unit has no close.
   */
  async accountValuer(
    workspaceId: string,
    accountIds: string[],
    currency: string,
    days: string[],
  ): Promise<(accountId: string, date: string) => number | null> {
    const holdings = accountIds.length
      ? await this.holdingRepository.find({ where: { workspaceId, accountId: In(accountIds) } })
      : [];
    const trades = holdings.length
      ? await this.tradeRepository.find({
          where: { workspaceId, holdingId: In(holdings.map(holding => holding.id)) },
          order: ENTRY_ORDER,
        })
      : [];
    const closes = await this.prices.closesFor(
      workspaceId,
      holdings.flatMap(holding => (holding.symbol ? [holding.symbol] : [])),
    );
    const method = await this.settings.basisMethod(workspaceId);
    const priced = new Map<string, Array<{ states: LedgerState[]; closes: DatedClose[] }> | null>();
    for (const accountId of accountIds) {
      const lines: Array<{ states: LedgerState[]; closes: DatedClose[] }> = [];
      let known = true;
      for (const holding of holdings.filter(item => item.accountId === accountId)) {
        const own = trades.filter(trade => trade.holdingId === holding.id);
        if (!countsUnits(own)) {
          // Nothing held and nothing traded says nothing about the past either way.
          if (Number(holding.quantity) !== 0) known = false;
          continue;
        }
        lines.push({
          states: ledgerStates(own.map(toTradeEvent), method),
          closes: holding.symbol ? (closes.get(holding.symbol) ?? []) : [],
        });
      }
      // An account with no traded holding has nothing to replay: its past stays unknown.
      priced.set(accountId, known && lines.length > 0 ? lines : null);
    }
    const convert = await this.converter(workspaceId, currency, [...closes.values()].flat(), days);
    return (accountId, date) => {
      const lines = priced.get(accountId);
      return lines ? pricedValueOn(lines, date, convert) : null;
    };
  }

  /** The feed is asked once per symbol; a feed that is down leaves the stored closes. */
  private async backfill(symbol: string): Promise<void> {
    try {
      await this.prices.ensureBackfilled(symbol);
    } catch (error) {
      this.logger.warn(`Backfill of ${symbol} failed: ${String(error)}`);
    }
  }

  private async converter(
    workspaceId: string,
    target: string,
    closes: DatedClose[],
    days: string[],
  ): Promise<Convert> {
    const converter = await CurrencyConverter.loadRange(
      this.exchangeRatesService,
      target,
      closes.map(close => close.currency),
      days,
      workspaceId,
    );
    return (amount, currency, date) => {
      if (currency === target) return amount;
      const converted = converter.convert(amount, currency, date);
      return converted === 0 && amount !== 0 ? null : converted;
    };
  }
}

/** Today's close is the price the page shows for the holding, as everywhere else. */
function withToday(stored: DatedClose[], holding: InvestmentHolding, today: string): DatedClose[] {
  const price = Number(holding.price);
  if (!(price > 0)) return stored;
  return mergeCloses(stored, [
    {
      date: today,
      close: price,
      currency: holding.priceCurrency,
      source: holding.priceSource === InvestmentPriceSource.AUTO ? 'auto' : 'manual',
    },
  ]);
}

function decimateBy<T extends { date: string }>(
  points: T[],
  metric: (point: T) => number | null,
): T[] {
  return decimate(
    points.map(point => ({ date: point.date, value: metric(point) ?? 0, point })),
    MAX_POINTS,
  ).map(entry => entry.point);
}
