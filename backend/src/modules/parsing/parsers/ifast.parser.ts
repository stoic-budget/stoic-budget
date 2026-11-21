import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's registered name in every page's footer and its monthly statement title. */
const IFAST_NAME = /\biFAST Global Bank Limited\b/i;
const IFAST_TITLE = /\bMonthly Statement\b/;
/** "Multi Currency Account GBP(£)": one section per currency. */
const CURRENCY_SECTION = /^\s*Multi Currency Account ([A-Z]{3})\(/gm;

export function isIfastStatement(text: string): boolean {
  return IFAST_NAME.test(text) && IFAST_TITLE.test(text);
}

export function ifastEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  if (/^Inbound\b/i.test(text)) {
    return { ...row, paymentType: 'bank_transfer_in' };
  }
  if (/^Outbound\b/i.test(text)) {
    return { ...row, paymentType: 'bank_transfer_out' };
  }
  return /^Credit interest\b/i.test(text) ? { ...row, paymentType: 'interest' } : row;
}

/**
 * iFAST Global Bank (UK) monthly statement of a multi-currency account: a
 * summary per currency, then a section per currency ("Multi Currency Account
 * GBP(£)") with Transaction Date, Description, Debit, Credit and Balance
 * between the opening balance and the balance carried forward. The generic
 * layout reading reads the section with movements; this names the bank and
 * types the rows. With several currency sections, a labelled opening balance
 * may be another currency's, so it is no check on this one's rows.
 */
export class IfastParser extends BankPdfParser {
  protected readonly bank = BankName.IFAST;

  protected recognises(text: string): boolean {
    return isIfastStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const currencies = new Set(Array.from(text.matchAll(CURRENCY_SECTION), match => match[1]));
    return currencies.size > 1
      ? {
          ...statement,
          checks: statement.checks?.filter(check => check.code !== 'printed_balances'),
        }
      : statement;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ifastEntry(row);
  }
}
