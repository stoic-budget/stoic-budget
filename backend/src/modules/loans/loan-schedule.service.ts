import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { LoanSchedule, LoanWhatIf, LoanWhatIfBody } from '../../contracts';
import { Transaction } from '../../entities/transaction.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { walletLedgers } from '../wallets/wallet-ledger';
import { buildSchedule, projectSchedule, whatIf } from './engine/loan-plan';
import { LoanTermsService } from './loan-terms.service';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The schedule of a debt account, held against what the account really owes. */
@Injectable()
export class LoanScheduleService {
  constructor(
    private readonly loanTerms: LoanTermsService,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async schedule(walletId: string, workspaceId: string, today = todayIso()): Promise<LoanSchedule> {
    const { wallet, input } = await this.loanTerms.planOf(walletId, workspaceId);
    const plan = buildSchedule(input);
    const ledger = (
      await walletLedgers(this.transactions, this.exchangeRates, workspaceId, [wallet])
    ).get(wallet.id);

    // A debt account keeps its balance below zero: what is owed is its opposite.
    const opening = Number(wallet.initialBalance) || 0;
    const days = ledger?.days ?? [];
    const hasActual = opening !== 0 || days.length > 0;
    const owedOn = (date: string) =>
      round2(-(opening + days.filter(day => day.date <= date).reduce((s, day) => s + day.net, 0)));

    const owedToday = owedOn(today);
    const lastPast = [...plan.rows].reverse().find(row => row.date <= today);
    const plannedToday = lastPast ? lastPast.balance : input.principal;
    const projection = hasActual ? projectSchedule(input, today, owedToday) : null;

    return {
      currency: wallet.currency,
      startDate: input.startDate,
      principal: input.principal,
      today,
      plan: {
        ...plan,
        rows: plan.rows.map(row => ({
          ...row,
          actualBalance: hasActual && row.date <= today ? owedOn(row.date) : null,
        })),
      },
      actual: hasActual
        ? {
            balance: owedToday,
            plannedBalance: plannedToday,
            difference: round2(owedToday - plannedToday),
          }
        : null,
      projection,
    };
  }

  async whatIf(walletId: string, workspaceId: string, body: LoanWhatIfBody): Promise<LoanWhatIf> {
    const { input } = await this.loanTerms.planOf(walletId, workspaceId);
    return whatIf(input, {
      extraPayments: body.extraPayments ?? [],
      recurringExtras: body.recurringExtra ? [body.recurringExtra] : [],
      extraMode: body.mode,
    });
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
