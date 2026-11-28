import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { Payable } from '../../entities/payable.entity';
import { TransactionType } from '../../entities/transaction.entity';
import { notRejectedSql } from '../payables/payable-payments.util';
import { PayablesService } from '../payables/payables.service';

/** How far from its due date a payment into the loan account may be and still pay the bill. */
export const MATCH_WINDOW_DAYS = 15;
/**
 * How much less than the bill a payment may be and still pay it: a bank's
 * rounding or fee, not a refund or cashback on a card paid in instalments.
 */
export const MATCH_SHORTFALL = 0.05;

interface OpenBill {
  id: string;
  due_date: string;
  outstanding: string;
}

interface PaymentRow {
  id: string;
  date: string;
  available: string;
}

/**
 * Money that reached a loan account pays the loan's bill for that date: the
 * bank's payment, imported or typed, and a transfer from another account
 * alike. Each open bill takes the payment closest to its due date within
 * `MATCH_WINDOW_DAYS` that pays no bill yet (nor does its other leg) and is
 * about the bill's amount or more (`MATCH_SHORTFALL`), unless the person
 * refused that payment for that bill. A smaller one is left for the person,
 * and so is any row on a credit card that is not a transfer from an account:
 * a card's incoming rows are refunds and cashback too. The bill is paid up to what
 * it asks; what the payment has on top (an extra repayment) stays unmatched.
 */
@Injectable()
export class LoanPaymentMatcher {
  private readonly logger = new Logger(LoanPaymentMatcher.name);

  constructor(
    @InjectRepository(Payable) private readonly payables: Repository<Payable>,
    private readonly payablesService: PayablesService,
  ) {}

  /** Returns how many bills got a payment. */
  async settle(workspaceId: string, walletId: string): Promise<number> {
    const bills: OpenBill[] = await this.payables.query(
      `SELECT p."id", p."due_date"::text AS "due_date",
              (p."amount" - p."paid_amount")::text AS "outstanding"
         FROM "payables" p
        WHERE p."workspace_id" = $1 AND p."loan_wallet_id" = $2 AND p."deleted_at" IS NULL
          AND p."status" NOT IN ('paid', 'archived') AND p."skipped_at" IS NULL
          AND p."due_date" IS NOT NULL AND p."amount" - p."paid_amount" > 0.005
        ORDER BY p."due_date", p."id"`,
      [workspaceId, walletId],
    );
    const used = new Set<string>();
    let settled = 0;
    for (const bill of bills) {
      const least = Number(bill.outstanding) * (1 - MATCH_SHORTFALL);
      const payment = (await this.paymentsFor(workspaceId, walletId, bill)).find(
        row => !used.has(row.id) && Number(row.available) >= least,
      );
      if (!payment) continue;
      used.add(payment.id);
      const amount = Math.min(Number(payment.available), Number(bill.outstanding));
      try {
        await this.payablesService.addPayment(bill.id, workspaceId, null, {
          amount: Math.round(amount * 100) / 100,
          linkedTransactionId: payment.id,
          paidOn: payment.date,
        });
        settled += 1;
      } catch (error) {
        // Changed under us (paid by hand, removed): the next run looks again.
        this.logger.warn(
          `Could not settle loan bill ${bill.id} with payment ${payment.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return settled;
  }

  /** Payments into the account that may pay this bill, the closest to its due date first. */
  private paymentsFor(
    workspaceId: string,
    walletId: string,
    bill: OpenBill,
  ): Promise<PaymentRow[]> {
    return this.payables.query(
      `SELECT t."id", t."transaction_date"::date::text AS "date",
              (GREATEST(ABS(COALESCE(t."amount", 0)), COALESCE(t."credit", 0))
                - COALESCE((SELECT SUM(pp."amount" - pp."fee_amount") FROM "payable_payments" pp
                             WHERE pp."transaction_id" = t."id"), 0))::text AS "available"
         FROM "transactions" t
         JOIN "wallets" w ON w."id" = t."wallet_id" AND w."workspace_id" = t."workspace_id"
        WHERE t."workspace_id" = $1 AND t."wallet_id" = $2
          AND t."transaction_type" = $3 AND t."loan_interest_of_id" IS NULL
          AND upper(t."currency") = upper(w."currency")
          -- A card takes refunds and cashback too: only money moved in from an account pays it.
          AND (w."type" <> 'credit_card' OR t."transfer_pair_id" IS NOT NULL)
          AND ${countedSql('t')}
          AND abs(t."transaction_date"::date - $4::date) <= $5
          -- Paying no bill yet, and neither is the leg it came from.
          AND NOT EXISTS (
            SELECT 1 FROM "payable_payments" pp
             WHERE pp."transaction_id" = t."id"
                OR pp."transaction_id" IN (
                  SELECT leg."id" FROM "transactions" leg
                   WHERE t."transfer_pair_id" IS NOT NULL
                     AND leg."transfer_pair_id" = t."transfer_pair_id"
                     AND leg."workspace_id" = t."workspace_id"))
          AND ${notRejectedSql('$6', 't."id"')}
        ORDER BY abs(t."transaction_date"::date - $4::date), t."transaction_date", t."id"`,
      [workspaceId, walletId, TransactionType.INCOME, bill.due_date, MATCH_WINDOW_DAYS, bill.id],
    );
  }
}
