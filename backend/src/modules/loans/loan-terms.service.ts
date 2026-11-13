import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { assertFound } from '../../common/utils/assert-found.util';
import type { LoanTermsBody, LoanTermsItem, LoanTermsState } from '../../contracts';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { DEBT_WALLET_TYPES, Wallet } from '../../entities/wallet.entity';
import type { LoanPlanInput } from './engine/loan-plan';

const toDay = (value: string | Date): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

/** The terms of a debt account: read, replaced as a whole, removed. */
@Injectable()
export class LoanTermsService {
  constructor(
    @InjectRepository(LoanTerms) private readonly terms: Repository<LoanTerms>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
  ) {}

  async get(walletId: string, workspaceId: string): Promise<LoanTermsState> {
    const wallet = await this.walletOf(walletId, workspaceId);
    const row = await this.terms.findOne({ where: { walletId: wallet.id, workspaceId } });
    return { terms: row ? this.toItem(row, wallet) : null };
  }

  async put(walletId: string, workspaceId: string, body: LoanTermsBody): Promise<LoanTermsState> {
    const wallet = await this.walletOf(walletId, workspaceId);
    if (!DEBT_WALLET_TYPES.includes(wallet.type)) {
      throw new BadRequestException(appError('LOAN_TERMS_DEBT_ONLY'));
    }
    // One row per account: a second save of the same account replaces the first.
    await this.terms.upsert(
      {
        workspaceId,
        walletId: wallet.id,
        principal: String(body.principal),
        startDate: body.startDate,
        termMonths: body.termMonths,
        paymentDay: body.paymentDay,
        method: body.method,
        dayCount: body.dayCount,
        annualRate: String(body.annualRate),
        rateChanges: (body.rateChanges ?? []).map(({ from, annualRate }) => ({ from, annualRate })),
        extraPayments: (body.extraPayments ?? []).map(({ date, amount }) => ({ date, amount })),
        recurringExtra: body.recurringExtra
          ? { amount: body.recurringExtra.amount, from: body.recurringExtra.from }
          : null,
        extraMode: body.extraMode ?? 'reduce_term',
        updatedAt: new Date(),
      },
      ['walletId'],
    );
    return this.get(wallet.id, workspaceId);
  }

  async remove(walletId: string, workspaceId: string): Promise<void> {
    const wallet = await this.walletOf(walletId, workspaceId);
    await this.terms.delete({ walletId: wallet.id, workspaceId });
  }

  /** The account and its terms as the schedule engine takes them; 404 while there are none. */
  async planOf(
    walletId: string,
    workspaceId: string,
  ): Promise<{ wallet: Wallet; terms: LoanTerms; input: LoanPlanInput }> {
    const wallet = await this.walletOf(walletId, workspaceId);
    const terms = await this.terms.findOne({ where: { walletId: wallet.id, workspaceId } });
    assertFound(terms, 'Loan terms');
    return {
      wallet,
      terms,
      input: {
        principal: Number(terms.principal),
        startDate: toDay(terms.startDate),
        termMonths: terms.termMonths,
        paymentDay: terms.paymentDay,
        method: terms.method,
        dayCount: terms.dayCount,
        annualRate: Number(terms.annualRate),
        rateChanges: terms.rateChanges,
        extraPayments: terms.extraPayments,
        recurringExtras: terms.recurringExtra ? [terms.recurringExtra] : [],
        extraMode: terms.extraMode,
      },
    };
  }

  private async walletOf(walletId: string, workspaceId: string): Promise<Wallet> {
    const wallet = await this.wallets.findOne({ where: { id: walletId, workspaceId } });
    assertFound(wallet, 'Wallet');
    return wallet;
  }

  private toItem(row: LoanTerms, wallet: Wallet): LoanTermsItem {
    return {
      id: row.id,
      walletId: row.walletId,
      currency: wallet.currency,
      principal: String(row.principal),
      startDate: toDay(row.startDate),
      termMonths: row.termMonths,
      paymentDay: row.paymentDay,
      method: row.method,
      dayCount: row.dayCount,
      annualRate: String(row.annualRate),
      rateChanges: row.rateChanges,
      extraPayments: row.extraPayments,
      recurringExtra: row.recurringExtra,
      extraMode: row.extraMode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
