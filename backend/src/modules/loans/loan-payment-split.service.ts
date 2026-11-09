import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { type EntityManager, In, IsNull, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import type { LoanPaymentItem } from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import type { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { ensureCanEditStatements } from '../statements/statement-access';
import type { LoanPlanInput } from './engine/loan-plan';
import { buildInterestRow } from './loan-interest-row';
import { amountOf, loadInterest, loadPayments, planOfPayments, toDay } from './loan-payment-rows';
import { LoanPaymentsService } from './loan-payments.service';
import { LoanTermsService } from './loan-terms.service';

/**
 * Splits a loan payment into principal and interest, and joins it back.
 *
 * The payment row is never touched: the checking leg keeps the whole amount
 * out, the loan leg the whole amount in, and the pair stays as it was. The
 * interest is a new expense row on the loan account (as the bank charges it),
 * so the debt falls by the principal only and the interest counts as spending
 * once. Joining back deletes that row (every part of it) and nothing else;
 * the database joins it back by itself once the payment leaves the loan.
 */
@Injectable()
export class LoanPaymentSplitService {
  private readonly logger = new Logger(LoanPaymentSplitService.name);

  constructor(
    private readonly loanTerms: LoanTermsService,
    private readonly payments: LoanPaymentsService,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    @InjectRepository(LoanTerms) private readonly terms: Repository<LoanTerms>,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly audit: AuditService,
  ) {}

  async split(
    walletId: string,
    transactionId: string,
    workspaceId: string,
    userId: string,
    viewerMemberId: string | null,
    interest: number,
  ): Promise<LoanPaymentItem> {
    await ensureCanEditStatements(this.members, userId, workspaceId);
    const { wallet, input } = await this.loanTerms.planOf(walletId, workspaceId);
    const created = await this.transactions.manager.transaction(async manager => {
      const payment = await this.lockPayment(manager, wallet, transactionId);
      this.assertSplittable(payment, wallet, input);
      const amount = toMinor(amountOf(payment));
      if (toMinor(interest) > amount) {
        throw new BadRequestException(
          appError('LOAN_PAYMENT_INTEREST_TOO_LARGE', { amount: fromMinor(amount) }),
        );
      }
      const existing = await manager
        .getRepository(Transaction)
        .count({ where: { workspaceId, loanInterestOfId: payment.id } });
      if (existing > 0) {
        throw new ConflictException(appError('LOAN_PAYMENT_ALREADY_SPLIT'));
      }
      return this.insertInterest(manager, payment, wallet, toMinor(interest));
    });
    await this.afterChange(workspaceId, userId, created.loanInterestOfId as string, {
      operation: 'loan_split',
      interestTransactionId: created.id,
      interest: fromMinor(toMinor(interest)),
    });
    const listed = await this.payments.list(wallet.id, workspaceId, viewerMemberId);
    return listed.items.find(item => item.transactionId === transactionId) as LoanPaymentItem;
  }

  /** Joins a split payment back: its interest row goes. A payment not split is left as it is. */
  async rejoin(
    walletId: string,
    transactionId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    await ensureCanEditStatements(this.members, userId, workspaceId);
    const { wallet } = await this.loanTerms.planOf(walletId, workspaceId);
    const removed = await this.transactions.manager.transaction(async manager => {
      const payment = await this.lockPayment(manager, wallet, transactionId);
      const repo = manager.getRepository(Transaction);
      const interest = (await loadInterest(repo, workspaceId, [payment.id])).get(payment.id);
      if (!interest) {
        return null;
      }
      if (interest.rows.some(row => row.taxLocked)) {
        throw new BadRequestException(appError('TRANSACTION_UNSPLIT_TAX_LOCKED'));
      }
      await repo.delete({ workspaceId, id: In(interest.rows.map(row => row.id)) });
      return interest;
    });
    if (removed) {
      await this.afterChange(workspaceId, userId, transactionId, {
        operation: 'loan_rejoin',
        interestTransactionId: removed.id,
        interest: fromMinor(removed.minor),
      });
    }
  }

  /**
   * After an import: splits the new payments into each loan account that asks
   * for it, by the schedule. A payment the schedule gives no interest (an
   * extra payment) and one it cannot divide are left whole.
   */
  async autoSplit(workspaceId: string, transactionIds: string[]): Promise<number> {
    if (transactionIds.length === 0) {
      return 0;
    }
    const fresh = await this.transactions.find({
      select: { id: true, walletId: true },
      where: { workspaceId, id: In(transactionIds), transactionType: TransactionType.INCOME },
    });
    const walletIds = [...new Set(fresh.flatMap(row => row.walletId ?? []))];
    if (walletIds.length === 0) {
      return 0;
    }
    const loans = await this.terms.find({
      where: { workspaceId, walletId: In(walletIds), autoSplit: true },
    });
    let split = 0;
    for (const loan of loans) {
      const { wallet, input } = await this.loanTerms.planOf(loan.walletId, workspaceId);
      const payments = await loadPayments(this.transactions, workspaceId, wallet.id);
      const interest = await loadInterest(
        this.transactions,
        workspaceId,
        payments.map(row => row.id),
      );
      const plans = planOfPayments(input, wallet.currency, payments);
      const wanted = new Set(fresh.filter(row => row.walletId === wallet.id).map(row => row.id));
      for (const payment of payments) {
        const suggestion = plans.get(payment.id)?.suggestion;
        if (
          !wanted.has(payment.id) ||
          interest.has(payment.id) ||
          payment.splitGroupId ||
          !suggestion ||
          suggestion.interest <= 0
        ) {
          continue;
        }
        await this.transactions.manager.transaction(manager =>
          this.insertInterest(manager, payment, wallet, toMinor(suggestion.interest)),
        );
        split++;
      }
    }
    if (split > 0) {
      await this.invalidateReports(workspaceId);
      this.logger.log(`Split ${split} loan payment(s) on import in ${workspaceId}`);
    }
    return split;
  }

  /** The payment row on this loan account, locked for the change. */
  private async lockPayment(
    manager: EntityManager,
    wallet: Wallet,
    transactionId: string,
  ): Promise<Transaction> {
    const payment = await manager.getRepository(Transaction).findOne({
      where: {
        id: transactionId,
        workspaceId: wallet.workspaceId,
        walletId: wallet.id,
        transactionType: TransactionType.INCOME,
        loanInterestOfId: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payment) {
      throw new NotFoundException(appError('LOAN_PAYMENT_NOT_FOUND'));
    }
    return payment;
  }

  private assertSplittable(payment: Transaction, wallet: Wallet, input: LoanPlanInput): void {
    // A suspected duplicate counts nowhere and is not listed as a payment.
    if (payment.isDuplicate) {
      throw new NotFoundException(appError('LOAN_PAYMENT_NOT_FOUND'));
    }
    if (payment.currency.trim().toUpperCase() !== wallet.currency.trim().toUpperCase()) {
      throw new BadRequestException(
        appError('LOAN_PAYMENT_CURRENCY', {
          currency: payment.currency,
          loanCurrency: wallet.currency,
        }),
      );
    }
    if (toDay(payment.transactionDate) < input.startDate) {
      throw new BadRequestException(
        appError('LOAN_PAYMENT_BEFORE_START', { startDate: input.startDate }),
      );
    }
    if (payment.splitGroupId) {
      throw new BadRequestException(appError('LOAN_PAYMENT_SPLIT_PART'));
    }
  }

  private async insertInterest(
    manager: EntityManager,
    payment: Transaction,
    wallet: Wallet,
    minor: number,
  ): Promise<Transaction> {
    const repo = manager.getRepository(Transaction);
    return repo.save(repo.create(await buildInterestRow(manager, payment, wallet, minor)));
  }

  private async afterChange(
    workspaceId: string,
    userId: string,
    paymentId: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    await this.invalidateReports(workspaceId);
    await this.audit.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: paymentId,
      action: AuditAction.UPDATE,
      diff: { before: null, after: meta },
      meta,
      isUndoable: false,
    });
  }

  /** The same key the transactions service bumps: every cached report is stale. */
  private async invalidateReports(workspaceId: string): Promise<void> {
    await this.cache.set(`reports:version:${workspaceId}`, Date.now().toString(), 0);
  }
}
