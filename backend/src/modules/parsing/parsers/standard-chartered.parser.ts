import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name in its notices and the statement's account details. */
const SC_NAME = /\bStandard Chartered\b/i;
const SC_DETAILS = /\bAccount Name\b[\s\S]*\bAccount Currency\b/i;

export function isStandardCharteredStatement(text: string): boolean {
  return SC_NAME.test(text) && SC_DETAILS.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:ATM WDR|CDM CASH DEPOSIT)\b/i, 'cash'],
  [/^POS\b/i, 'card'],
  [/^(?:INSTALLMENT|LOAN)\b/i, 'direct_debit'],
  [/\b(?:FEE|CHARGE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [/^(?:SALARY|IBANKING|TRANSFER|GIRO|FUND TRANSFER)\b/i, 'transfer'],
];

/** "POS PRCSE ACME TRADING SDN BHD 5995 …": the shop after the purchase code. */
const CARD_SHOP = /^POS PRCSE (.+?)(?: \d{4} .*)?$/i;

export function standardCharteredEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  if (!kind) {
    return row;
  }
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const shop = CARD_SHOP.exec(text)?.[1];
  return { ...row, paymentType, ...(shop ? { counterpartyName: shop } : {}) };
}

/**
 * Standard Chartered statement of account: the account's name, type,
 * currency and number, then Date, Description, Withdrawal, Deposit and
 * Balance from the opening to the closing balance, an empty money cell
 * printed "-". The generic layout reading does the table; this names the
 * bank and types the rows (cash, card, instalments, salary, transfers).
 */
export class StandardCharteredParser extends BankPdfParser {
  protected readonly bank = BankName.STANDARD_CHARTERED;

  protected recognises(text: string): boolean {
    return isStandardCharteredStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return standardCharteredEntry(row);
  }
}
