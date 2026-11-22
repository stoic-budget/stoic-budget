import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The program's web address in the contact box. */
const MONEYCARD_SITE = /\bwww\.WalmartMoneyCard\.com\b/i;
const DEBIT_ACCOUNT = /\bDEBIT ACCOUNT TRANSACTIONS\b/i;

export function isWalmartMoneyCardStatement(text: string): boolean {
  return MONEYCARD_SITE.test(text) && DEBIT_ACCOUNT.test(text);
}

/**
 * The debit account's summary comes first: its "Credits (4) +$1.57" and
 * "Debits (1) -$5.94" move the beginning balance to its ending one (the
 * savings account's summary below prints an "Ending Balance" of its own).
 */
export function debitAccountEnd(text: string, start: number): number | null {
  const credits = /\bCredits \(\d+\)\s*([+-]\$?[\d,]+\.\d{2})/i.exec(text)?.[1];
  const debits = /\bDebits \(\d+\)\s*([+-]\$?[\d,]+\.\d{2})/i.exec(text)?.[1];
  const [plus, minus] = [credits, debits].map(value =>
    value ? parseStatementAmount(value) : null,
  );
  return plus === null || minus === null ? null : Math.round((start + plus + minus) * 100) / 100;
}

/** The Type column's word, in the text after the party: "ACME NETWORK  Deposit  ACME PMT". */
const TYPES: [RegExp, PaymentType | 'transfer'][] = [
  [/\bFee\b/i, 'fee'],
  [/\b(?:Purchase|POS)\b/i, 'card'],
  [/\b(?:ATM|Cash)\b/i, 'cash'],
  [/\b(?:Deposit|Transfer|Withdrawal|Payment)\b/i, 'transfer'],
];

export function walmartMoneyCardEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, kind] of TYPES) {
    const match = pattern.exec(text);
    if (match) {
      const paymentType =
        kind === 'transfer'
          ? Number(row.credit) > 0
            ? 'bank_transfer_in'
            : 'bank_transfer_out'
          : kind;
      const party = text.slice(0, match.index).trim();
      return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
    }
  }
  return row;
}

/**
 * Walmart MoneyCard (US, issued by Green Dot) statement: the debit
 * account's Date, Description, Type, Amount (signed) and Available, newest
 * first, beside the summaries of the debit and the savings account. The
 * generic layout reading does the table; this names the program, works the
 * debit account's ending balance out of its summary and reads each row's
 * type and party.
 */
export class WalmartMoneyCardParser extends BankPdfParser {
  protected readonly bank = BankName.WALMART_MONEYCARD;

  protected recognises(text: string): boolean {
    return isWalmartMoneyCardStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const end = debitAccountEnd(text, statement.metadata.balanceStart ?? 0);
    if (end === null) {
      return statement;
    }
    // The savings account's "Ending Balance" was read as the statement's: its check is no failure.
    const checks = statement.checks?.filter(
      check =>
        !(
          check.code === 'printed_balances' &&
          check.detail?.side === 'end' &&
          Math.abs(Number(check.detail?.actual) - end) < 0.005
        ),
    );
    return {
      ...statement,
      metadata: { ...statement.metadata, balanceEnd: end },
      ...(checks && { checks }),
    };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return walmartMoneyCardEntry(row);
  }
}
