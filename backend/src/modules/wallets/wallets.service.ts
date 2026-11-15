import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceCrudBaseService } from '../../common/services/workspace-crud-base.service';
import { assertOwnerMemberInWorkspace } from '../../common/utils/transaction-owner.util';
import type {
  CreateWalletBody,
  UpdateWalletBody,
  WalletBalanceDays,
  WalletItem,
  WalletReconciliation,
  WalletSeries,
  WalletSummary,
} from '../../contracts';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { DEBT_WALLET_TYPES, SPENDABLE_WALLET_TYPES, Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import {
  addAmount,
  type CurrencyAmounts,
  CurrencyConverter,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { balanceDays, monthDates } from './wallet-balance-days';
import { toDateOnly, type WalletLedger, walletLedgers } from './wallet-ledger';

/** Statements whose rows are read and real; the same set the balance sheet trusts. */
const LIVE_STATEMENT_STATUSES = [
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
];

/** A closing balance within a cent of the booked one is the same balance. */
const RECONCILE_TOLERANCE = 0.01;

const round2 = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class WalletsService extends WorkspaceCrudBaseService<Wallet> {
  constructor(
    @InjectRepository(Wallet)
    repository: Repository<Wallet>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {
    super(repository, 'Wallet');
  }

  async create(workspaceId: string, userId: string, createDto: CreateWalletBody): Promise<Wallet> {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      createDto.ownerMemberId,
    );

    // wallets.user_id is NOT NULL: without it every create failed with a 500.
    const wallet = this.repository.create({
      workspaceId,
      userId,
      ...createDto,
      type: createDto.type ?? 'checking',
      currency: await this.workspaceCurrency.resolveFor(workspaceId, createDto.currency),
      initialBalance: createDto.initialBalance || 0,
      isActive: true,
    });

    return this.repository.save(wallet);
  }

  override async update(id: string, workspaceId: string, dto: UpdateWalletBody): Promise<Wallet> {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      dto.ownerMemberId,
    );
    return super.update(id, workspaceId, dto);
  }

  /** Every account of the workspace with its balance, for `GET /wallets`. */
  async list(workspaceId: string): Promise<WalletItem[]> {
    const wallets = await this.findAll(workspaceId);
    return this.withBalances(workspaceId, wallets);
  }

  async findOneWithBalance(id: string, workspaceId: string): Promise<WalletItem> {
    const wallet = await this.findOne(id, workspaceId);
    const [item] = await this.withBalances(workspaceId, [wallet]);
    return item;
  }

  /** Active accounts summed in the workspace currency, at today's rate. */
  async summary(workspaceId: string): Promise<WalletSummary> {
    const target = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));
    const active = (await this.list(workspaceId)).filter(wallet => wallet.isActive);

    const assets: CurrencyAmounts = new Map();
    const debts: CurrencyAmounts = new Map();
    for (const wallet of active) {
      const currency = normalizeCurrencyCode(wallet.currency);
      if (DEBT_WALLET_TYPES.includes(wallet.type)) {
        addAmount(debts, currency, -wallet.balance);
      } else {
        addAmount(assets, currency, wallet.balance);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const currencies = new Set([...assets.keys(), ...debts.keys()]);
    const converter = await CurrencyConverter.load(
      this.exchangeRates,
      target,
      [...currencies].map(currency => ({ currency, date: today })),
      workspaceId,
    );
    const assetsTotal = converter.convertAll(assets, today);
    const debtsTotal = converter.convertAll(debts, today);
    const unconverted = converter.missing.map(currency => ({
      currency,
      assets: round2(assets.get(currency) ?? 0),
      debts: round2(debts.get(currency) ?? 0),
    }));

    return {
      currency: target,
      assets: round2(assetsTotal),
      debts: round2(debtsTotal),
      unconverted,
    };
  }

  /** The balance at the end of each day the account moved, oldest first. */
  async series(id: string, workspaceId: string): Promise<WalletSeries> {
    const wallet = await this.findOne(id, workspaceId);
    const ledgers = await walletLedgers(
      this.transactionRepository,
      this.exchangeRates,
      workspaceId,
      [wallet],
    );

    let balance = Number(wallet.initialBalance) || 0;
    return (ledgers.get(wallet.id)?.days ?? []).map(day => {
      balance += day.net;
      return { date: day.date, balance: round2(balance) };
    });
  }

  /**
   * What each active everyday account (checking, cash, card) held at the end of
   * every day of `month`, converted to the workspace currency at that day's rate.
   */
  async balanceDays(workspaceId: string, month: string): Promise<WalletBalanceDays> {
    const currency = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));
    const wallets = (await this.findAll(workspaceId)).filter(
      wallet => wallet.isActive && SPENDABLE_WALLET_TYPES.includes(wallet.type),
    );
    const dates = monthDates(month);
    const ledgers = await walletLedgers(
      this.transactionRepository,
      this.exchangeRates,
      workspaceId,
      wallets,
    );
    // Rates exist up to today; a later day of this month takes today's, never a fetch for the future.
    const today = new Date().toISOString().slice(0, 10);
    const rateDates = dates.some(date => date <= today)
      ? dates.filter(date => date <= today)
      : dates;
    const lastRateDate = rateDates[rateDates.length - 1];
    const converter = await CurrencyConverter.loadRange(
      this.exchangeRates,
      currency,
      wallets.map(wallet => normalizeCurrencyCode(wallet.currency)),
      rateDates,
      workspaceId,
    );

    const series = wallets.map(wallet => {
      const own = normalizeCurrencyCode(wallet.currency);
      const balances = balanceDays(
        Number(wallet.initialBalance) || 0,
        ledgers.get(wallet.id)?.days ?? [],
        dates,
      );
      return balances.map((balance, index) => {
        // A rate is never 0, so one unit converting to 0 means the day has none.
        const rate = converter.convert(
          1,
          own,
          dates[index] > lastRateDate ? lastRateDate : dates[index],
        );
        return rate === 0 ? null : round2(balance * rate);
      });
    });

    return {
      currency,
      accounts: wallets.map(wallet => ({
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        currency: wallet.currency,
      })),
      days: dates.map((date, index) => ({
        date,
        balances: Object.fromEntries(wallets.map((wallet, at) => [wallet.id, series[at][index]])),
      })),
      // Both the account's own rows in another currency and the account itself, when either had no rate.
      unconverted: [
        ...new Set([
          ...converter.missing,
          ...wallets.flatMap(wallet => ledgers.get(wallet.id)?.unconverted ?? []),
        ]),
      ].sort(),
    };
  }

  private async withBalances(workspaceId: string, wallets: Wallet[]): Promise<WalletItem[]> {
    if (wallets.length === 0) {
      return [];
    }
    const [ledgers, pending] = await Promise.all([
      walletLedgers(this.transactionRepository, this.exchangeRates, workspaceId, wallets),
      this.pendingCounts(
        workspaceId,
        wallets.map(wallet => wallet.id),
      ),
    ]);
    const reconciliations = await this.reconciliations(workspaceId, wallets, ledgers);

    return wallets.map(wallet => {
      const ledger = ledgers.get(wallet.id);
      return {
        id: wallet.id,
        workspaceId: wallet.workspaceId,
        userId: wallet.userId,
        name: wallet.name,
        type: wallet.type,
        accountNumber: wallet.accountNumber,
        bankName: wallet.bankName,
        currency: wallet.currency,
        initialBalance: String(wallet.initialBalance ?? '0'),
        isActive: wallet.isActive,
        ownerMemberId: wallet.ownerMemberId,
        balance: round2((Number(wallet.initialBalance) || 0) + (ledger?.net ?? 0)),
        unconvertedCurrencies: ledger?.unconverted ?? [],
        transactionCount: ledger?.count ?? 0,
        pendingReviewCount: pending.get(wallet.id) ?? 0,
        lastActivityAt: ledger?.lastDate ?? null,
        reconciliation: reconciliations.get(wallet.id) ?? null,
        createdAt: wallet.createdAt.toISOString(),
        updatedAt: wallet.updatedAt.toISOString(),
      };
    });
  }

  /** Rows of each account still in Review, so the page can say why a balance lags the bank. */
  private async pendingCounts(
    workspaceId: string,
    walletIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.walletId', 'walletId')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.walletId IN (:...walletIds)', { walletIds })
      .andWhere('transaction.isVerified = false')
      .andWhere('transaction.isDuplicate = false')
      .groupBy('transaction.walletId')
      .getRawMany<{ walletId: string; count: string }>();
    return new Map(rows.map(row => [row.walletId, Number(row.count) || 0]));
  }

  /**
   * The latest statement of each account that states a closing balance,
   * against the balance booked up to its last day.
   */
  private async reconciliations(
    workspaceId: string,
    wallets: Wallet[],
    ledgers: Map<string, WalletLedger>,
  ): Promise<Map<string, WalletReconciliation>> {
    const latest = await this.statementRepository
      .createQueryBuilder('statement')
      .distinctOn(['statement.walletId'])
      .select(['statement.id', 'statement.walletId', 'statement.balanceEnd'])
      .addSelect('statement.statementDateTo')
      .where('statement.workspaceId = :workspaceId', { workspaceId })
      .andWhere('statement.walletId IN (:...walletIds)', {
        walletIds: wallets.map(wallet => wallet.id),
      })
      .andWhere('statement.deletedAt IS NULL')
      .andWhere('statement.balanceEnd IS NOT NULL')
      .andWhere('statement.statementDateTo IS NOT NULL')
      .andWhere('statement.status IN (:...statuses)', { statuses: LIVE_STATEMENT_STATUSES })
      .orderBy('statement.walletId')
      .addOrderBy('statement.statementDateTo', 'DESC')
      .addOrderBy('statement.createdAt', 'DESC')
      .getMany();

    const byId = new Map(wallets.map(wallet => [wallet.id, wallet]));
    const result = new Map<string, WalletReconciliation>();
    for (const statement of latest) {
      const wallet = statement.walletId ? byId.get(statement.walletId) : undefined;
      const date = toDateOnly(statement.statementDateTo);
      if (!(wallet && date)) {
        continue;
      }
      const booked = (ledgers.get(wallet.id)?.days ?? [])
        .filter(day => day.date <= date)
        .reduce((sum, day) => sum + day.net, 0);
      const computedBalance = round2((Number(wallet.initialBalance) || 0) + booked);
      const statementBalance = round2(Number(statement.balanceEnd));
      result.set(wallet.id, {
        statementId: statement.id,
        date,
        statementBalance,
        computedBalance,
        matches: Math.abs(computedBalance - statementBalance) <= RECONCILE_TOLERANCE,
      });
    }
    return result;
  }
}
