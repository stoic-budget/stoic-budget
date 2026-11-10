import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, type Repository } from 'typeorm';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import { canReadPrivate, PRIVATE_PLACEHOLDER } from '../../common/utils/transaction-privacy.util';
import type { LoanPaymentItem, LoanPayments } from '../../contracts';
import { Transaction } from '../../entities/transaction.entity';
import type { PaymentPlan } from './engine/loan-payment-planner';
import {
  amountOf,
  loadInterest,
  loadPayments,
  type PaymentInterest,
  planOfPayments,
  toDay,
} from './loan-payment-rows';
import { LoanTermsService } from './loan-terms.service';

/** The payments into a loan account, each with its split or the schedule's suggestion. */
@Injectable()
export class LoanPaymentsService {
  constructor(
    private readonly loanTerms: LoanTermsService,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
  ) {}

  async list(
    walletId: string,
    workspaceId: string,
    viewerMemberId: string | null,
  ): Promise<LoanPayments> {
    const { wallet, terms, input } = await this.loanTerms.planOf(walletId, workspaceId);
    const payments = await loadPayments(this.transactions, workspaceId, wallet.id);
    const ids = payments.map(row => row.id);
    const [interest, fromWallets] = await Promise.all([
      loadInterest(this.transactions, workspaceId, ids),
      this.otherLegWallets(workspaceId, payments),
    ]);
    const plans = planOfPayments(input, wallet.currency, payments);

    const items = payments.map(row =>
      this.toItem(row, plans.get(row.id), interest.get(row.id), fromWallets, viewerMemberId),
    );
    const split = items.flatMap(item => (item.split ? [item.split] : []));
    const sum = (values: number[]) => fromMinor(values.reduce((s, v) => s + toMinor(v), 0));
    return {
      currency: wallet.currency,
      autoSplit: terms.autoSplit,
      items,
      totals: {
        interest: sum(split.map(item => item.interest)),
        principal: sum(split.map(item => item.principal)),
        unsplit: items.filter(item => !item.split && !item.blocked).length,
      },
    };
  }

  private toItem(
    row: Transaction,
    plan: PaymentPlan | undefined,
    interest: PaymentInterest | undefined,
    fromWallets: Map<string, { id: string; name: string }>,
    viewerMemberId: string | null,
  ): LoanPaymentItem {
    const amount = toMinor(amountOf(row));
    return {
      transactionId: row.id,
      date: toDay(row.transactionDate),
      amount: fromMinor(amount),
      currency: row.currency,
      counterpartyName: canReadPrivate(row, viewerMemberId)
        ? row.counterpartyName
        : PRIVATE_PLACEHOLDER,
      fromWallet: (row.transferPairId && fromWallets.get(row.transferPairId)) || null,
      isVerified: row.isVerified,
      split: interest
        ? {
            interestTransactionId: interest.id,
            interest: fromMinor(interest.minor),
            principal: fromMinor(amount - interest.minor),
          }
        : null,
      suggestion: plan?.suggestion ?? null,
      // One part of a split row: rejoined it would lose an interest row on a deleted part.
      blocked: row.splitGroupId && !interest ? 'split_part' : (plan?.blocked ?? null),
    };
  }

  /** The account on the other side of each paired payment, by pair id. */
  private async otherLegWallets(
    workspaceId: string,
    payments: Transaction[],
  ): Promise<Map<string, { id: string; name: string }>> {
    const pairIds = [...new Set(payments.flatMap(row => row.transferPairId ?? []))];
    const result = new Map<string, { id: string; name: string }>();
    if (pairIds.length === 0) {
      return result;
    }
    const legs = await this.transactions.find({
      where: {
        workspaceId,
        transferPairId: In(pairIds),
        id: Not(In(payments.map(row => row.id))),
        wallet: { workspaceId },
      },
      relations: { wallet: true },
      select: { id: true, transferPairId: true, wallet: { id: true, name: true } },
    });
    for (const leg of legs) {
      if (leg.wallet && leg.transferPairId) {
        result.set(leg.transferPairId, { id: leg.wallet.id, name: leg.wallet.name });
      }
    }
    return result;
  }
}
