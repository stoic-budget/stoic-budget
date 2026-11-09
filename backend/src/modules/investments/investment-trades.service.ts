import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { LotMethod } from '../../common/lots/lot-book';
import { canReadPrivate } from '../../common/utils/transaction-privacy.util';
import type {
  CreateInvestmentTradeBody,
  HoldingLots,
  InvestmentTrade as TradeView,
  UpdateInvestmentTradeBody,
} from '../../contracts';
import { InvestmentAssetClass, InvestmentHolding } from '../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../entities/investment-trade.entity';
import { Transaction } from '../../entities/transaction.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { holdingValueIn } from './holding-value';
import { InvestmentSettingsService } from './investment-settings.service';
import { InvestmentsService } from './investments.service';
import {
  countsUnits,
  orderTrades,
  replayTrades,
  splitFactorSince,
  type TradeLedger,
  TradeReplayError,
} from './trade-ledger';
import { applyTradeBody, ENTRY_ORDER, pricedOn, toTradeEvent, toTradeView } from './trade-rules';

type TradeInput = UpdateInvestmentTradeBody;

/**
 * Trades behind a holding. Every write replays the holding's whole history
 * before it is stored, so a change that would leave a sale uncovered (a buy
 * deleted, a sale moved earlier) is refused rather than leaving the books
 * wrong; then the holding's quantity is the replay's, and the account's value
 * is written to the balance sheet as for any other holding change.
 */
@Injectable()
export class InvestmentTradesService {
  private readonly logger = new Logger(InvestmentTradesService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InvestmentTrade)
    private readonly tradeRepository: Repository<InvestmentTrade>,
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    private readonly investmentsService: InvestmentsService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly settings: InvestmentSettingsService,
  ) {}

  async list(workspaceId: string, holdingId: string): Promise<TradeView[]> {
    await this.requireHolding(this.dataSource.manager, workspaceId, holdingId);
    const trades = await this.load(this.dataSource.manager, workspaceId, holdingId);
    // The order the lots are built in, so the list reads the way the figures were made.
    return orderTrades(trades.map(trade => ({ ...toTradeEvent(trade), trade }))).map(entry =>
      toTradeView(entry.trade),
    );
  }

  async create(
    userId: string,
    workspaceId: string,
    viewerMemberId: string | null,
    holdingId: string,
    body: CreateInvestmentTradeBody,
  ): Promise<TradeView> {
    const id = await this.write(
      userId,
      workspaceId,
      holdingId,
      async (manager, holding, trades) => {
        const trade = manager.create(InvestmentTrade, { workspaceId, holdingId, note: null });
        await this.apply(manager, workspaceId, viewerMemberId, holding, trades, trade, body);
        return { trades: [...trades, trade], saved: trade };
      },
    );
    return this.view(workspaceId, id);
  }

  async update(
    userId: string,
    workspaceId: string,
    viewerMemberId: string | null,
    tradeId: string,
    body: UpdateInvestmentTradeBody,
  ): Promise<TradeView> {
    const { holdingId } = await this.requireTrade(workspaceId, tradeId);
    await this.write(userId, workspaceId, holdingId, async (manager, holding, trades) => {
      const trade = trades.find(item => item.id === tradeId);
      if (!trade) throw new NotFoundException(appError('INVESTMENTS_TRADE_NOT_FOUND'));
      const others = trades.filter(item => item !== trade);
      await this.apply(manager, workspaceId, viewerMemberId, holding, others, trade, body);
      return { trades, saved: trade };
    });
    return this.view(workspaceId, tradeId);
  }

  async remove(userId: string, workspaceId: string, tradeId: string): Promise<void> {
    const { holdingId } = await this.requireTrade(workspaceId, tradeId);
    await this.write(userId, workspaceId, holdingId, async (manager, _holding, trades) => {
      await manager.delete(InvestmentTrade, { id: tradeId, workspaceId });
      return { trades: trades.filter(item => item.id !== tradeId), saved: null };
    });
  }

  async lots(workspaceId: string, holdingId: string): Promise<HoldingLots> {
    const manager = this.dataSource.manager;
    const holding = await this.requireHolding(manager, workspaceId, holdingId);
    const trades = await this.load(manager, workspaceId, holdingId);
    const method = await this.settings.basisMethod(workspaceId);
    const ledger = replayTrades(trades.map(toTradeEvent), method);
    // Only dividends: they were paid on the typed quantity, bought at a cost nobody recorded.
    const onlyDividends = trades.length > 0 && !countsUnits(trades);
    const quantity = onlyDividends ? Number(holding.quantity) : ledger.quantity;
    const currency = trades[0]?.currency ?? null;
    const marketValue = currency
      ? await holdingValueIn({ ...holding, quantity }, currency, this.exchangeRatesService)
      : null;
    const { openLots, sales, years, ...figures } = ledger;
    return {
      holdingId,
      ...figures,
      quantity,
      currency,
      marketValue: marketValue === null ? null : round2(marketValue),
      unrealizedGain:
        marketValue === null || onlyDividends ? null : round2(marketValue - ledger.costBasis),
      openLots,
      sales,
      years,
    };
  }

  /**
   * Re-derives the quantity of holdings whose trades changed outside this
   * service (an import, its undo) and rewrites their accounts' value. A
   * holding with no trades left (or only dividends) keeps the quantity it has.
   * `alsoAccounts`: accounts whose holdings were deleted, rewritten too.
   */
  async syncHoldings(
    userId: string,
    workspaceId: string,
    holdingIds: string[],
    alsoAccounts: string[] = [],
  ): Promise<void> {
    if (holdingIds.length + alsoAccounts.length === 0) return;
    const holdings = holdingIds.length
      ? await this.holdingRepository.find({
          where: { workspaceId, id: In([...new Set(holdingIds)]) },
        })
      : [];
    const method = await this.settings.basisMethod(workspaceId);
    for (const holding of holdings) {
      const trades = await this.load(this.dataSource.manager, workspaceId, holding.id);
      if (!countsUnits(trades)) continue;
      try {
        const { quantity } = replayTrades(trades.map(toTradeEvent), method);
        await this.holdingRepository.update({ id: holding.id, workspaceId }, { quantity });
      } catch (error) {
        this.logger.warn(`Trades of holding ${holding.id} do not replay: ${String(error)}`);
      }
    }
    // A holding an import created has no price yet; pricing it writes its account too.
    const unpriced = holdings.filter(holding => holding.symbol && !holding.pricedAt);
    if (unpriced.length > 0) {
      await this.investmentsService.refreshPrices(
        userId,
        workspaceId,
        unpriced.map(h => h.id),
      );
    }
    for (const accountId of new Set([...holdings.map(h => h.accountId), ...alsoAccounts])) {
      await this.investmentsService.writeSnapshot(userId, workspaceId, accountId);
    }
  }

  /** Refuses to take these trades away when what stays would oversell a holding. */
  async assertRemovable(workspaceId: string, tradeIds: string[]): Promise<void> {
    if (tradeIds.length === 0) return;
    const removed = new Set(tradeIds);
    const touched = await this.tradeRepository.find({
      where: { workspaceId, id: In(tradeIds) },
      select: { id: true, holdingId: true },
    });
    for (const holdingId of new Set(touched.map(trade => trade.holdingId))) {
      const kept = (await this.load(this.dataSource.manager, workspaceId, holdingId)).filter(
        trade => !removed.has(trade.id),
      );
      this.replayOrRefuse(kept, null, 'fifo');
    }
  }

  /**
   * One change to a holding's trades, under a lock on the holding so two
   * writes cannot both pass the replay and together oversell it.
   */
  private async write(
    userId: string,
    workspaceId: string,
    holdingId: string,
    change: (
      manager: EntityManager,
      holding: InvestmentHolding,
      trades: InvestmentTrade[],
    ) => Promise<{ trades: InvestmentTrade[]; saved: InvestmentTrade | null }>,
  ): Promise<string> {
    const method = await this.settings.basisMethod(workspaceId);
    const { accountId, savedId } = await this.dataSource.transaction(async manager => {
      const holding = await this.requireHolding(manager, workspaceId, holdingId, true);
      if (holding.assetClass === InvestmentAssetClass.METAL) {
        throw new BadRequestException(appError('INVESTMENTS_TRADES_NOT_FOR_METALS'));
      }
      const before = await this.load(manager, workspaceId, holdingId);
      const factorBefore = splitFactorSince(before.map(toTradeEvent), pricedOn(holding));
      const { trades, saved } = await change(manager, holding, before);
      const ledger = this.replayOrRefuse(trades, saved, method);
      if (saved) await manager.save(saved);
      const factorAfter = splitFactorSince(trades.map(toTradeEvent), pricedOn(holding));
      await manager.update(
        InvestmentHolding,
        { id: holdingId, workspaceId },
        {
          // Dividends alone leave a typed quantity; trades that said it and are gone leave 0.
          quantity: countsUnits(trades)
            ? ledger.quantity
            : countsUnits(before)
              ? 0
              : holding.quantity,
          // A split after the quote changes what one unit is worth, never what the holding is.
          price: (Number(holding.price) * factorBefore) / factorAfter,
        },
      );
      return { accountId: holding.accountId, savedId: saved?.id ?? '' };
    });
    await this.investmentsService.writeSnapshot(userId, workspaceId, accountId);
    return savedId;
  }

  /** The stored row: decimals and dates as the read answers them. */
  private async view(workspaceId: string, tradeId: string): Promise<TradeView> {
    return toTradeView(await this.requireTrade(workspaceId, tradeId));
  }

  private replayOrRefuse(
    trades: InvestmentTrade[],
    saved: InvestmentTrade | null,
    method: LotMethod,
  ): TradeLedger {
    try {
      // A new trade has no id yet; the engine only needs one to name the culprit.
      return replayTrades(
        trades.map(trade =>
          toTradeEvent(trade === saved && !trade.id ? { ...trade, id: 'new' } : trade),
        ),
        method,
      );
    } catch (error) {
      if (error instanceof TradeReplayError) {
        throw new BadRequestException(appError('INVESTMENTS_TRADE_EXCEEDS_HOLDING'));
      }
      throw error;
    }
  }

  /** Writes `body` onto `trade`; a newly named cash leg is looked up first. */
  private async apply(
    manager: EntityManager,
    workspaceId: string,
    viewerMemberId: string | null,
    holding: InvestmentHolding,
    others: InvestmentTrade[],
    trade: InvestmentTrade,
    body: TradeInput,
  ): Promise<void> {
    const linkChanged =
      body.transactionId !== undefined && body.transactionId !== trade.transactionId;
    applyTradeBody(trade, body, others[0]?.currency ?? holding.priceCurrency, others[0]?.currency);
    if (linkChanged) {
      trade.transactionId = body.transactionId
        ? await this.requireTransaction(manager, workspaceId, viewerMemberId, body.transactionId)
        : null;
    }
  }

  /** The cash leg: a row of this workspace the caller can read. */
  private async requireTransaction(
    manager: EntityManager,
    workspaceId: string,
    viewerMemberId: string | null,
    transactionId: string,
  ): Promise<string> {
    const row = await manager.findOne(Transaction, {
      where: { id: transactionId, workspaceId },
      select: { id: true, isPrivate: true, ownerMemberId: true },
    });
    // Another member's private row is as good as absent: linking it would name it.
    if (!(row && canReadPrivate(row, viewerMemberId))) {
      throw new NotFoundException(appError('INVESTMENTS_TRANSACTION_NOT_FOUND'));
    }
    return row.id;
  }

  private load(manager: EntityManager, workspaceId: string, holdingId: string) {
    return manager.find(InvestmentTrade, { where: { workspaceId, holdingId }, order: ENTRY_ORDER });
  }

  private async requireHolding(
    manager: EntityManager,
    workspaceId: string,
    holdingId: string,
    lock = false,
  ): Promise<InvestmentHolding> {
    const holding = await manager.findOne(InvestmentHolding, {
      where: { id: holdingId, workspaceId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!holding) throw new NotFoundException(appError('INVESTMENTS_HOLDING_NOT_FOUND'));
    return holding;
  }

  private async requireTrade(workspaceId: string, tradeId: string): Promise<InvestmentTrade> {
    const trade = await this.tradeRepository.findOne({ where: { id: tradeId, workspaceId } });
    if (!trade) throw new NotFoundException(appError('INVESTMENTS_TRADE_NOT_FOUND'));
    return trade;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
