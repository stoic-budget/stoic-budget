import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { appError } from '../../common/errors/app-error';
import { notInVersionWorkspace } from '../../common/workspaces/version-workspaces';
import type {
  CreateInvestmentAccountBody,
  InvestmentHolding as HoldingView,
  InvestmentAccount as InvestmentAccountView,
  UpsertHoldingBody,
} from '../../contracts';
import { BalanceAccount, BalanceAccountKind } from '../../entities/balance-account.entity';
import {
  InvestmentAssetClass,
  InvestmentHolding,
  InvestmentPriceSource,
} from '../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../entities/investment-trade.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { BalanceService } from '../balance/balance.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { holdingValueIn, holdingView } from './holding-value';
import { InvestmentFlowsService } from './investment-flows.service';
import { round2 } from './returns-sources';
import { normalizeStockSymbol, StockPriceService } from './stock-price.service';

const INVESTMENTS_SECTION_CODE = 'ASSET_INVESTMENTS';

export type { HoldingView, InvestmentAccountView };

/**
 * Investment and retirement accounts: sub-accounts of the balance sheet's
 * "Investments" section with holdings behind them. Every change writes the
 * account's value as today's balance snapshot, so the sheet and net worth
 * read the same number this service computed.
 */
@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    @InjectRepository(BalanceAccount)
    private readonly accountRepository: Repository<BalanceAccount>,
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly balanceService: BalanceService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly stockPriceService: StockPriceService,
    private readonly flowsService: InvestmentFlowsService,
    // Last and optional so a test that builds the service by hand needs no trades.
    @InjectRepository(InvestmentTrade)
    private readonly tradeRepository?: Repository<InvestmentTrade>,
  ) {}

  async listAccounts(workspaceId: string): Promise<InvestmentAccountView[]> {
    await this.balanceService.seedDefaultAccounts(workspaceId);
    const currency = await this.workspaceCurrency(workspaceId);
    const accounts = await this.accountRepository.find({
      where: {
        workspaceId,
        accountKind: In([BalanceAccountKind.INVESTMENT, BalanceAccountKind.RETIREMENT]),
      },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    if (accounts.length === 0) return [];
    const holdings = await this.holdingRepository.find({
      where: { workspaceId, accountId: In(accounts.map(account => account.id)) },
      order: { createdAt: 'ASC' },
    });
    const traded = await this.tradedHoldingIds(workspaceId);
    const { flows } = await this.flowsService.valueFlows(
      workspaceId,
      await this.flowsService.loadFlows(
        workspaceId,
        accounts.map(account => account.id),
      ),
      currency,
    );
    const views: InvestmentAccountView[] = [];
    for (const account of accounts) {
      const rows: HoldingView[] = [];
      for (const holding of holdings.filter(item => item.accountId === account.id)) {
        rows.push(await this.view(holding, currency, traded.has(holding.id)));
      }
      const value = round2(rows.reduce((sum, row) => sum + row.value, 0));
      const totals = { contribution: 0, withdrawal: 0, income: 0 };
      for (const flow of flows) {
        if (flow.accountId === account.id) {
          totals[flow.kind] += flow.value;
        }
      }
      const netInvested = totals.contribution - totals.withdrawal;
      views.push({
        id: account.id,
        name: account.name,
        // The query above reads only these two kinds.
        kind: account.accountKind as BalanceAccountKind.INVESTMENT | BalanceAccountKind.RETIREMENT,
        currency,
        value,
        contributed: round2(totals.contribution),
        withdrawn: round2(totals.withdrawal),
        income: round2(totals.income),
        netInvested: round2(netInvested),
        gain: round2(value - netInvested + totals.income),
        holdings: rows,
      });
    }
    return views;
  }

  async createAccount(
    userId: string,
    workspaceId: string,
    dto: CreateInvestmentAccountBody,
  ): Promise<InvestmentAccountView> {
    await this.balanceService.seedDefaultAccounts(workspaceId);
    const section = await this.accountRepository.findOne({
      where: { workspaceId, code: INVESTMENTS_SECTION_CODE },
    });
    if (!section) throw new NotFoundException(appError('INVESTMENTS_SECTION_NOT_FOUND'));
    const created = await this.balanceService.createCustomAccount(userId, workspaceId, {
      name: dto.name,
      parentId: section.id,
    });
    await this.accountRepository.update(
      { id: created.id, workspaceId },
      { accountKind: toEnum(BalanceAccountKind, dto.kind) ?? BalanceAccountKind.INVESTMENT },
    );
    const view = (await this.listAccounts(workspaceId)).find(account => account.id === created.id);
    if (!view) throw new NotFoundException(appError('INVESTMENTS_ACCOUNT_NOT_FOUND'));
    return view;
  }

  async deleteAccount(userId: string, workspaceId: string, accountId: string): Promise<void> {
    await this.requireAccount(workspaceId, accountId);
    await this.holdingRepository.delete({ workspaceId, accountId });
    await this.transactionRepository.update(
      { workspaceId, investmentAccountId: accountId },
      {
        investmentAccountId: null,
        transferPairId: null,
        transferPairSource: null,
        transferPairKind: null,
      },
    );
    await this.balanceService.deleteCustomAccount(userId, workspaceId, accountId);
  }

  async addHolding(
    userId: string,
    workspaceId: string,
    accountId: string,
    dto: UpsertHoldingBody,
  ): Promise<HoldingView> {
    await this.requireAccount(workspaceId, accountId);
    if (!(dto.name || dto.symbol)) {
      throw new BadRequestException(appError('INVESTMENTS_HOLDING_NAME_REQUIRED'));
    }
    const symbol = dto.symbol ? normalizeStockSymbol(dto.symbol) : null;
    const holding = this.holdingRepository.create({
      workspaceId,
      accountId,
      symbol,
      name: dto.name ?? symbol ?? '',
      assetClass: toEnum(InvestmentAssetClass, dto.assetClass) ?? InvestmentAssetClass.OTHER,
      quantity: dto.quantity ?? 0,
      price: dto.price ?? 0,
      priceCurrency: (dto.priceCurrency ?? 'USD').toUpperCase(),
      priceSource: InvestmentPriceSource.MANUAL,
      pricedAt: dto.price !== undefined ? new Date() : null,
    });
    const saved = await this.holdingRepository.save(holding);
    if (saved.symbol && dto.price === undefined) {
      await this.refreshPrices(userId, workspaceId, [saved.id]);
    }
    await this.writeSnapshot(userId, workspaceId, accountId);
    return this.view(
      await this.requireHolding(workspaceId, saved.id),
      await this.workspaceCurrency(workspaceId),
    );
  }

  async updateHolding(
    userId: string,
    workspaceId: string,
    holdingId: string,
    dto: UpsertHoldingBody,
  ): Promise<HoldingView> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    const hasTrades = (await this.tradedHoldingIds(workspaceId, holdingId)).size > 0;
    // Trades say how much is held; a typed number would be undone by the next one.
    if (dto.quantity != null && hasTrades) {
      throw new BadRequestException(appError('INVESTMENTS_QUANTITY_FROM_TRADES'));
    }
    if (dto.symbol !== undefined) {
      holding.symbol = dto.symbol ? normalizeStockSymbol(dto.symbol) : null;
    }
    if (dto.name != null) holding.name = dto.name;
    if (dto.assetClass != null) holding.assetClass = toEnum(InvestmentAssetClass, dto.assetClass);
    if (dto.quantity != null) holding.quantity = dto.quantity;
    if (dto.price != null) {
      holding.price = dto.price;
      holding.priceSource = InvestmentPriceSource.MANUAL;
      holding.pricedAt = new Date();
    }
    if (dto.priceCurrency != null) holding.priceCurrency = dto.priceCurrency.toUpperCase();
    await this.holdingRepository.save(holding);
    await this.writeSnapshot(userId, workspaceId, holding.accountId);
    return this.view(holding, await this.workspaceCurrency(workspaceId), hasTrades);
  }

  async deleteHolding(userId: string, workspaceId: string, holdingId: string): Promise<void> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    await this.holdingRepository.remove(holding);
    await this.writeSnapshot(userId, workspaceId, holding.accountId);
  }

  /** Workspaces holding something that has a price to fetch. */
  async workspacesWithPricedHoldings(): Promise<string[]> {
    const rows = await this.holdingRepository
      .createQueryBuilder('holding')
      .select('DISTINCT holding.workspaceId', 'workspaceId')
      .where('holding.symbol IS NOT NULL')
      // A past version is a frozen copy: repricing it would rewrite its history.
      .andWhere(notInVersionWorkspace('holding.workspaceId'))
      .getRawMany<{ workspaceId: string }>();
    return rows.map(row => row.workspaceId);
  }

  /**
   * Fetches a price for every holding with a symbol (stocks and funds from
   * Yahoo Finance) and rewrites the snapshots of the accounts that changed. Returns how
   * many holdings got a price. Coins are not here: they live in `crypto_wallets`.
   */
  async refreshPrices(
    userId: string | null,
    workspaceId: string,
    onlyIds?: string[],
  ): Promise<number> {
    const holdings = await this.holdingRepository.find({
      where: onlyIds ? { workspaceId, id: In(onlyIds) } : { workspaceId },
    });
    const priced = holdings.filter(holding => holding.symbol);
    if (priced.length === 0) return 0;

    const stocks = await this.stockPriceService.getPrices(
      priced.map(holding => holding.symbol as string),
    );

    let updated = 0;
    const touched = new Set<string>();
    for (const holding of priced) {
      const quote = stocks.get(normalizeStockSymbol(holding.symbol as string));
      if (!quote) continue;
      holding.price = quote.price;
      holding.priceCurrency = quote.currency;
      holding.priceSource = InvestmentPriceSource.AUTO;
      holding.pricedAt = new Date();
      await this.holdingRepository.save(holding);
      touched.add(holding.accountId);
      updated += 1;
    }
    for (const accountId of touched) {
      await this.writeSnapshot(userId, workspaceId, accountId);
    }
    return updated;
  }

  /** Holdings grouped by asset class, valued in the workspace currency; for net worth. */
  async valueByAssetClass(
    workspaceId: string,
    excludedAccountIds: Set<string> = new Set(),
  ): Promise<Map<InvestmentAssetClass, number>> {
    const currency = await this.workspaceCurrency(workspaceId);
    const holdings = await this.holdingRepository.find({ where: { workspaceId } });
    const totals = new Map<InvestmentAssetClass, number>();
    for (const holding of holdings) {
      // An account the page is not showing takes its holdings with it.
      if (excludedAccountIds.has(holding.accountId)) {
        continue;
      }
      const { value } = await this.view(holding, currency);
      totals.set(holding.assetClass, (totals.get(holding.assetClass) ?? 0) + value);
    }
    return totals;
  }

  private view(holding: InvestmentHolding, currency: string, hasTrades = false) {
    return holdingView(holding, currency, this.exchangeRatesService, hasTrades);
  }

  /** Holdings of the workspace (or the one asked about) whose quantity their trades give. */
  private async tradedHoldingIds(workspaceId: string, holdingId?: string): Promise<Set<string>> {
    if (!this.tradeRepository) return new Set();
    const rows = await this.tradeRepository
      .createQueryBuilder('trade')
      .select('DISTINCT trade.holdingId', 'holdingId')
      .where('trade.workspaceId = :workspaceId', { workspaceId })
      .andWhere("trade.kind <> 'dividend'") // a dividend says nothing about how much is held
      .andWhere(holdingId ? 'trade.holdingId = :holdingId' : '1=1', { holdingId })
      .getRawMany<{ holdingId: string }>();
    return new Set(rows.map(row => row.holdingId));
  }

  /**
   * The account's value today, written where the balance sheet and net worth
   * read it. Public because the metals service keeps its own account the same way.
   */
  async writeSnapshot(
    userId: string | null,
    workspaceId: string,
    accountId: string,
  ): Promise<void> {
    const currency = await this.workspaceCurrency(workspaceId);
    const holdings = await this.holdingRepository.find({ where: { workspaceId, accountId } });
    let total = 0;
    for (const holding of holdings) {
      const value = await holdingValueIn(holding, currency, this.exchangeRatesService);
      // A value we cannot state is not a zero: written down, it would read as
      // the money having gone. The account keeps its last known value.
      if (value === null) {
        this.logger.warn(`No rate for account ${accountId}: keeping its last snapshot`);
        return;
      }
      total += round2(value);
    }
    await this.balanceService.updateSnapshot(userId, workspaceId, {
      accountId,
      amount: round2(total),
      currency,
    });
  }

  private async requireAccount(workspaceId: string, accountId: string): Promise<BalanceAccount> {
    const account = await this.accountRepository.findOne({ where: { id: accountId, workspaceId } });
    if (!account?.accountKind) {
      throw new NotFoundException(appError('INVESTMENTS_ACCOUNT_NOT_FOUND'));
    }
    return account;
  }

  private async requireHolding(workspaceId: string, holdingId: string): Promise<InvestmentHolding> {
    const holding = await this.holdingRepository.findOne({ where: { id: holdingId, workspaceId } });
    if (!holding) throw new NotFoundException(appError('INVESTMENTS_HOLDING_NOT_FOUND'));
    return holding;
  }

  /** Public for the metals service, which prices lots in the same currency. */
  async workspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
    });
    const normalized = String(workspace?.currency || '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
  }
}
