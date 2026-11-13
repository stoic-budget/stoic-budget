import { type FindOptionsWhere, In, Not, type Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import {
  type Statement,
  StatementStatus,
  type Transaction,
  type Wallet,
  type WorkspaceMember,
} from '../../entities';
import { DEBT_WALLET_TYPES } from '../../entities/wallet.entity';
import {
  addAmount,
  type CurrencyAmounts,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { alignTransferLegs, loadTransferLegs } from './balance-transfer-legs';

/** Cash over time for the balance sheet and net worth: from accounts, and from bank statements. */

const LIVE_STATEMENT_STATUSES = [
  StatementStatus.PARSED,
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
];

const toNumber = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
};

const toDateOnly = (value: string | Date): string => new Date(value).toISOString().split('T')[0];

/** Both series added up, date by date. */
export function sumSeries(
  dates: string[],
  first: Map<string, CurrencyAmounts>,
  second: Map<string, CurrencyAmounts>,
): Map<string, CurrencyAmounts> {
  const series = new Map<string, CurrencyAmounts>();
  for (const date of dates) {
    const amounts: CurrencyAmounts = new Map(first.get(date));
    for (const [currency, amount] of second.get(date) ?? []) {
      addAmount(amounts, currency, amount);
    }
    series.set(date, amounts);
  }
  return series;
}

/** Every amount with its sign flipped: what a debt account's balance owes. */
export function negateSeries(series: Map<string, CurrencyAmounts>): Map<string, CurrencyAmounts> {
  return new Map(
    [...series].map(([date, amounts]) => [
      date,
      new Map([...amounts].map(([currency, amount]) => [currency, -amount])),
    ]),
  );
}

/**
 * Which accounts a series walks: every active one, or, with `includeInNetWorth`
 * set, only those whose setting matches it.
 */
export type WalletScope = { includeInNetWorth?: boolean };

/** The scope net worth reads with: an account set not to count is left out of its whole history. */
export const NET_WORTH_SCOPE: WalletScope = { includeInNetWorth: true };

/** The accounts net worth would have read but leaves out. */
const LEFT_OUT_SCOPE: WalletScope = { includeInNetWorth: false };

/** The active accounts of the workspace matching `where`, as a series reads them. */
export function seriesWallets(
  walletRepository: Repository<Wallet>,
  workspaceId: string,
  where: FindOptionsWhere<Wallet>,
  scope: WalletScope,
) {
  return walletRepository.find({
    where: {
      ...where,
      workspaceId,
      isActive: true,
      ...(scope.includeInNetWorth === undefined
        ? {}
        : { includeInNetWorth: scope.includeInNetWorth }),
    },
    select: { id: true, initialBalance: true, currency: true },
  });
}

/** The accounts the cash line walks: every active one that is not a debt, of a current member. */
export async function cashWallets(
  walletRepository: Repository<Wallet>,
  memberRepository: Repository<WorkspaceMember>,
  workspaceId: string,
  scope: WalletScope,
) {
  const members = await memberRepository.find({ where: { workspaceId }, select: { userId: true } });
  const memberIds = [...new Set(members.map(member => member.userId))];
  // Обязательно фильтруем по workspaceId: участник может состоять в нескольких
  // воркспейсах, и без фильтра сюда утекали бы кошельки чужого тенанта.
  return memberIds.length > 0
    ? seriesWallets(
        walletRepository,
        workspaceId,
        { userId: In(memberIds), type: Not(In([...DEBT_WALLET_TYPES])) },
        scope,
      )
    : [];
}

/**
 * Ids of the accounts set not to count that net worth would otherwise read:
 * the same selection as its cash line and its debts, so the count the page
 * shows is the number of accounts actually missing from its figures.
 */
export async function walletsLeftOutOfNetWorth(
  walletRepository: Repository<Wallet>,
  memberRepository: Repository<WorkspaceMember>,
  workspaceId: string,
): Promise<string[]> {
  const debts = { type: In([...DEBT_WALLET_TYPES]) };
  const wallets = await Promise.all([
    cashWallets(walletRepository, memberRepository, workspaceId, LEFT_OUT_SCOPE),
    seriesWallets(walletRepository, workspaceId, debts, LEFT_OUT_SCOPE),
  ]);
  return wallets.flat().map(wallet => wallet.id);
}

export async function walletCashSeries(
  transactionRepository: Repository<Transaction>,
  workspaceId: string,
  wallets: Array<Pick<Wallet, 'id' | 'initialBalance' | 'currency'>>,
  dates: string[],
): Promise<Map<string, CurrencyAmounts>> {
  const walletIds = wallets.map(wallet => wallet.id);
  const to = dates[dates.length - 1];

  const [rows, transferLegs] = await Promise.all([
    onlyCounted(
      transactionRepository
        .createQueryBuilder('transaction')
        .leftJoin('transaction.statement', 'statement')
        .select('transaction.transactionDate', 'date')
        .addSelect('transaction.currency', 'currency')
        .addSelect('COALESCE(SUM(transaction.credit), 0)', 'credit')
        .addSelect('COALESCE(SUM(transaction.debit), 0)', 'debit')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    )
      .andWhere('transaction.walletId IN (:...walletIds)', { walletIds })
      .andWhere('transaction.transactionDate <= :to', { to })
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
      .groupBy('transaction.transactionDate')
      .addGroupBy('transaction.currency')
      .orderBy('transaction.transactionDate', 'ASC')
      .getRawMany<{ date: string; currency: string; credit: string; debit: string }>(),
    loadTransferLegs(transactionRepository, workspaceId, walletIds, to),
  ]);

  const movements = rows.map(row => ({
    date: toDateOnly(row.date),
    currency: normalizeCurrencyCode(row.currency),
    amount: toNumber(row.credit) - toNumber(row.debit),
  }));
  movements.push(...alignTransferLegs(transferLegs));
  movements.sort((left, right) => left.date.localeCompare(right.date));

  const running: CurrencyAmounts = new Map();
  for (const wallet of wallets) {
    addAmount(running, normalizeCurrencyCode(wallet.currency), toNumber(wallet.initialBalance));
  }

  const series = new Map<string, CurrencyAmounts>();
  let index = 0;
  for (const date of dates) {
    while (index < movements.length && movements[index].date <= date) {
      addAmount(running, movements[index].currency, movements[index].amount);
      index += 1;
    }
    series.set(date, new Map(running));
  }
  return series;
}

export async function statementCashSeries(
  statementRepository: Repository<Statement>,
  workspaceId: string,
  dates: string[],
): Promise<Map<string, CurrencyAmounts>> {
  // A statement without a closing date counts from the day it was uploaded.
  const rows = await statementRepository
    .createQueryBuilder('statement')
    .select('statement.bankName', 'bankName')
    .addSelect('statement.accountNumber', 'accountNumber')
    .addSelect('statement.currency', 'currency')
    .addSelect('statement.balanceEnd', 'balanceEnd')
    .addSelect('COALESCE(statement.statementDateTo, DATE(statement.createdAt))', 'date')
    .where('statement.workspaceId = :workspaceId', { workspaceId })
    .andWhere('statement.balanceEnd IS NOT NULL')
    .andWhere('statement.deletedAt IS NULL')
    .andWhere('statement.status IN (:...statuses)', { statuses: LIVE_STATEMENT_STATUSES })
    // Held by an account: its money is in the account's balance already.
    // Rows booked to an account by the old default-wallet guess count too.
    .andWhere('statement.walletId IS NULL')
    .andWhere(
      'NOT EXISTS (SELECT 1 FROM transactions held WHERE held.statement_id = statement.id AND held.wallet_id IS NOT NULL)',
    )
    .orderBy('date', 'ASC')
    .addOrderBy('statement.createdAt', 'ASC')
    .getRawMany<{
      bankName: string | null;
      accountNumber: string | null;
      currency: string | null;
      balanceEnd: string;
      date: string;
    }>();

  // The latest closing balance per bank account, then summed per currency.
  const latestByAccount = new Map<string, { currency: string; balance: number }>();
  const series = new Map<string, CurrencyAmounts>();
  let index = 0;
  for (const date of dates) {
    while (index < rows.length && toDateOnly(rows[index].date) <= date) {
      const row = rows[index];
      const currency = normalizeCurrencyCode(row.currency);
      latestByAccount.set(`${row.bankName ?? ''}|${row.accountNumber ?? ''}|${currency}`, {
        currency,
        balance: toNumber(row.balanceEnd),
      });
      index += 1;
    }
    const amounts: CurrencyAmounts = new Map();
    for (const { currency, balance } of latestByAccount.values()) {
      addAmount(amounts, currency, balance);
    }
    series.set(date, amounts);
  }
  return series;
}
