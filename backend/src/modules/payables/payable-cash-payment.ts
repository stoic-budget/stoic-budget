import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { MarkPayablePaidBody } from '../../contracts';
import { Category } from '../../entities/category.entity';
import { type Payable, PayableDirection } from '../../entities/payable.entity';
import { PayablePayment } from '../../entities/payable-payment.entity';
import {
  Transaction,
  TransactionType,
  TransferPairSource,
} from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { transactionCreatedEvent } from '../notifications/events/notification-events';

const round2 = (value: number) => Math.round(Number(value) * 100) / 100;

/**
 * Records a payment made in cash or from a wallet as a new transaction of
 * that wallet, and returns its id. A loan's bill paid from a wallet is money
 * moved into the loan account: the payment becomes a transfer whose other leg
 * lands there, so the debt falls and nothing counts as spending. Paid in hand
 * (cash at the bank), only that leg is booked: the money came from no account.
 */
export async function recordCashPayment(
  manager: EntityManager,
  payable: Payable,
  /** Null: cash handed over in person and kept in no wallet. */
  walletId: string | null,
  payload: Pick<MarkPayablePaidBody, 'paidOn' | 'categoryId'>,
  /** What was handed over now; the whole bill when not said otherwise. */
  paidAmount: number | undefined,
  queueEvent: (name: string, payload: unknown) => void,
): Promise<string> {
  const workspaceId = payable.workspaceId;
  const currency = payable.currency.toUpperCase();
  const wallet = walletId
    ? await manager.getRepository(Wallet).findOne({
        where: { id: walletId, workspaceId },
        select: { id: true, currency: true },
      })
    : null;
  if (walletId && !wallet) {
    throw new BadRequestException(appError('PAYABLE_WALLET_NOT_FOUND'));
  }
  if (wallet && wallet.currency.toUpperCase() !== currency) {
    throw new BadRequestException(
      appError('PAYABLE_WALLET_CURRENCY_MISMATCH', {
        walletCurrency: wallet.currency.toUpperCase(),
        currency,
      }),
    );
  }
  const loan = payable.loanWalletId ? await loanAccountOf(manager, payable) : null;
  if (loan && wallet?.id === loan.id) {
    // From the loan to itself: the debt would not move, yet the bill would read paid.
    throw new BadRequestException(appError('PAYABLE_LOAN_PAID_FROM_ITSELF'));
  }
  if (payload.categoryId && !loan) {
    const category = await manager.getRepository(Category).exists({
      where: { id: payload.categoryId, workspaceId },
    });
    if (!category) {
      throw new BadRequestException(appError('PAYABLE_CATEGORY_NOT_FOUND'));
    }
  }

  const isIncome = payable.direction === PayableDirection.RECEIVABLE;
  const amount = round2(paidAmount ?? Number(payable.amount));
  const transactions = manager.getRepository(Transaction);
  if (loan && !wallet) {
    // Cash paid in at the bank: money from no account of the person's reaches the loan.
    const leg = await intoLoanAccount(manager, loan, {
      workspaceId,
      date: payload.paidOn ? new Date(payload.paidOn) : new Date(),
      counterpartyName: payable.vendor,
      paymentPurpose: payable.comment || payable.vendor,
      amount,
      currency,
      transferPairId: null,
    });
    queueEvent('transaction.created', transactionCreatedEvent(leg, 'payment'));
    return leg.id;
  }
  const transaction = await transactions.save(
    transactions.create({
      workspaceId,
      statementId: null,
      walletId: wallet?.id ?? null,
      transactionDate: payload.paidOn ? new Date(payload.paidOn) : new Date(),
      counterpartyName: payable.vendor,
      paymentPurpose: payable.comment || payable.vendor,
      amount,
      debit: isIncome ? null : amount,
      credit: isIncome ? amount : null,
      currency,
      transactionType: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
      // Money between the owner's own accounts has no spending category.
      categoryId: loan ? null : (payload.categoryId ?? null),
      // The user recorded this payment by hand.
      isVerified: true,
    }),
  );
  queueEvent('transaction.created', transactionCreatedEvent(transaction, 'payment'));
  if (loan) {
    await pairWithLoanAccount(manager, transaction, loan);
  }
  return transaction.id;
}

/** The loan account of the bill, in its workspace and currency. */
async function loanAccountOf(
  manager: EntityManager,
  payable: Payable,
): Promise<Pick<Wallet, 'id' | 'ownerMemberId'>> {
  const loan = await manager.getRepository(Wallet).findOne({
    where: { id: payable.loanWalletId as string, workspaceId: payable.workspaceId },
    select: { id: true, currency: true, ownerMemberId: true },
  });
  if (!loan || loan.currency.toUpperCase() !== payable.currency.toUpperCase()) {
    throw new BadRequestException(appError('PAYABLE_WALLET_NOT_FOUND'));
  }
  return loan;
}

interface LoanLeg {
  workspaceId: string;
  date: Date;
  counterpartyName: string;
  paymentPurpose: string;
  amount: number;
  currency: string;
  transferPairId: string | null;
}

/** The payment as it reaches the loan account: an incoming row there, confirmed. */
function intoLoanAccount(
  manager: EntityManager,
  loan: Pick<Wallet, 'id' | 'ownerMemberId'>,
  leg: LoanLeg,
): Promise<Transaction> {
  const transactions = manager.getRepository(Transaction);
  return transactions.save(
    transactions.create({
      workspaceId: leg.workspaceId,
      statementId: null,
      walletId: loan.id,
      ownerMemberId: loan.ownerMemberId,
      transactionDate: leg.date,
      counterpartyName: leg.counterpartyName,
      paymentPurpose: leg.paymentPurpose,
      amount: leg.amount,
      debit: null,
      credit: leg.amount,
      currency: leg.currency,
      transactionType: TransactionType.INCOME,
      isVerified: true,
      transferPairId: leg.transferPairId,
      transferPairSource: leg.transferPairId ? TransferPairSource.MANUAL : null,
    }),
  );
}

/** The other leg of a payment from a wallet, on the loan account, and the pair that joins them. */
async function pairWithLoanAccount(
  manager: EntityManager,
  payment: Transaction,
  loan: Pick<Wallet, 'id' | 'ownerMemberId'>,
): Promise<void> {
  const transferPairId = randomUUID();
  await intoLoanAccount(manager, loan, {
    workspaceId: payment.workspaceId,
    date: payment.transactionDate,
    counterpartyName: payment.counterpartyName,
    paymentPurpose: payment.paymentPurpose,
    amount: Number(payment.amount),
    currency: payment.currency,
    transferPairId,
  });
  await manager
    .getRepository(Transaction)
    .update(
      { id: payment.id, workspaceId: payment.workspaceId },
      { transferPairId, transferPairSource: TransferPairSource.MANUAL },
    );
}

/**
 * Takes one payment off its bill. On a loan's bill the rows it stood on (the
 * transfer the app booked, or a bank row) are refused for that bill, as "not
 * this payment" does, so the matcher does not settle it with them again.
 */
export async function deletePayment(
  manager: EntityManager,
  payment: Pick<PayablePayment, 'id' | 'payableId' | 'workspaceId' | 'transactionId'>,
): Promise<void> {
  await manager.getRepository(PayablePayment).delete({ id: payment.id });
  if (!payment.transactionId) return;
  await manager.query(
    `INSERT INTO "payable_match_rejections" ("workspace_id", "payable_id", "transaction_id")
     SELECT t."workspace_id", p."id", t."id"
       FROM "payables" p
       JOIN "transactions" t ON t."workspace_id" = p."workspace_id"
      WHERE p."id" = $2 AND p."workspace_id" = $1 AND p."loan_wallet_id" IS NOT NULL
        AND (t."id" = $3 OR t."transfer_pair_id" = (
              SELECT "transfer_pair_id" FROM "transactions"
               WHERE "id" = $3 AND "workspace_id" = $1 AND "transfer_pair_id" IS NOT NULL))
     ON CONFLICT DO NOTHING`,
    [payment.workspaceId, payment.payableId, payment.transactionId],
  );
}
