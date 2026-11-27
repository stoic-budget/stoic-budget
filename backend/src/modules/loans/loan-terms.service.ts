import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { assertFound } from '../../common/utils/assert-found.util';
import type { LoanTermsBody, LoanTermsItem, LoanTermsState } from '../../contracts';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { DEBT_WALLET_TYPES, Wallet } from '../../entities/wallet.entity';
import { type LoanPlanInput, paymentDates, roundsWithinTerm } from './engine/loan-plan';
import { planInputOf } from './loan-plan-input';
import { LoanRemindersService } from './loan-reminders.service';

const toDay = (value: string | Date): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

/** The terms of a debt account: read, replaced as a whole, removed. */
@Injectable()
export class LoanTermsService {
  private readonly logger = new Logger(LoanTermsService.name);

  constructor(
    @InjectRepository(LoanTerms) private readonly terms: Repository<LoanTerms>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    private readonly reminders: LoanRemindersService,
  ) {}

  async get(walletId: string, workspaceId: string): Promise<LoanTermsState> {
    const wallet = await this.walletOf(walletId, workspaceId);
    const row = await this.terms.findOne({ where: { walletId: wallet.id, workspaceId } });
    return { terms: row ? this.toItem(row, wallet) : null };
  }

  async put(walletId: string, workspaceId: string, body: LoanTermsBody): Promise<LoanTermsState> {
    // A date past the year 9999 has five digits of year: no `date` the schedule can answer.
    if (paymentDates(body).at(-1)?.length !== 10) {
      throw new BadRequestException(appError('LOAN_TERMS_END_TOO_LATE'));
    }
    const rateChanges = (body.rateChanges ?? []).map(({ from, annualRate }) => ({
      from,
      annualRate,
    }));
    if (
      !roundsWithinTerm({
        ...body,
        rateChanges,
        extraPayments: [],
        recurringExtras: [],
        extraMode: 'reduce_term',
      })
    ) {
      throw new BadRequestException(appError('LOAN_TERMS_ROUNDING'));
    }
    // The account row stays locked from the type check to the save: a change
    // of type waits for it, and then deletes the terms (wallets/wallet-change.ts).
    await this.wallets.manager.transaction(async manager => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: walletId, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      assertFound(wallet, 'Wallet');
      if (!DEBT_WALLET_TYPES.includes(wallet.type)) {
        throw new BadRequestException(appError('LOAN_TERMS_DEBT_ONLY'));
      }
      // One row per account: a second save of the same account replaces the first.
      await manager.getRepository(LoanTerms).upsert(
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
          rateChanges,
          extraPayments: (body.extraPayments ?? []).map(({ date, amount }) => ({ date, amount })),
          recurringExtra: body.recurringExtra
            ? { amount: body.recurringExtra.amount, from: body.recurringExtra.from }
            : null,
          extraMode: body.extraMode ?? 'reduce_term',
          autoSplit: body.autoSplit ?? false,
          remindDaysBefore: body.remindDaysBefore ?? null,
          updatedAt: new Date(),
        },
        ['walletId'],
      );
    });
    await this.followReminders(workspaceId, walletId);
    return this.get(walletId, workspaceId);
  }

  async remove(walletId: string, workspaceId: string): Promise<void> {
    const wallet = await this.walletOf(walletId, workspaceId);
    await this.terms.delete({ walletId: wallet.id, workspaceId });
    await this.followReminders(workspaceId, wallet.id);
  }

  /** The payment bills follow the terms just saved; a failure is retried by the morning job. */
  private async followReminders(workspaceId: string, walletId: string): Promise<void> {
    try {
      await this.reminders.sync(workspaceId, walletId);
    } catch (error) {
      this.logger.error(
        `Failed to bring the payment bills of loan ${walletId} in step`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** The account and its terms as the schedule engine takes them; 404 while there are none. */
  async planOf(
    walletId: string,
    workspaceId: string,
  ): Promise<{ wallet: Wallet; terms: LoanTerms; input: LoanPlanInput }> {
    const wallet = await this.walletOf(walletId, workspaceId);
    const terms = await this.terms.findOne({ where: { walletId: wallet.id, workspaceId } });
    assertFound(terms, 'Loan terms');
    return { wallet, terms, input: planInputOf(terms) };
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
      autoSplit: row.autoSplit,
      remindDaysBefore: row.remindDaysBefore,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
