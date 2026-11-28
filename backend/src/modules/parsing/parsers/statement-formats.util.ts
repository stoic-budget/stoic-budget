import { decodeEntities } from '../helpers/markup-entities.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';

/**
 * Pure parsers for the interchange formats banks export besides CSV:
 * OFX/QFX (SGML or XML), QIF, ISO 20022 camt.052/053/054 and SWIFT MT940. Each takes
 * the file's text and returns the same shape the bank parsers do, so the
 * import pipeline (dedupe, rules, review) does not know the difference.
 */

/* ----------------------------------------------------------------------- */
/* Format sniffing                                                           */
/* ----------------------------------------------------------------------- */

export type TextStatementFormat = 'ofx' | 'qif' | 'camt' | 'mt940';

/** What a text file is, from its first few kilobytes; null when it is none of them. */
export function sniffStatementFormat(sample: string): TextStatementFormat | null {
  const head = sample.slice(0, 8192);
  if (/OFXHEADER|<OFX>|<\?OFX/i.test(head)) return 'ofx';
  if (/^\s*!(Type|Account|Option)/i.test(head)) return 'qif';
  if (/BkToCstmrStmt|BkToCstmrAcctRpt|BkToCstmrDbtCdtNtfctn|camt\.05[234]/i.test(head))
    return 'camt';
  if (/^\s*(\{1:|:20:)/.test(head) && /:61:/.test(sample)) return 'mt940';
  return null;
}

/* ----------------------------------------------------------------------- */
/* OFX / QFX                                                                 */
/* ----------------------------------------------------------------------- */

const ofxDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const digits = value.replace(/\[.*$/, '').trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/.exec(digits);
  if (!match) return null;
  const [, y, m, d, hh = '0', mm = '0', ss = '0'] = match;
  return new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)),
  );
};

/** The value of the first `<TAG>value` or `<TAG>value</TAG>` in a block. */
function ofxTag(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
  return match ? decodeEntities(match[1].trim()) : undefined;
}

/**
 * A row a bank-sync pull marks as pending (`bank-sync-ofx.util.ts`). OFX has
 * no word for it, so the mark is a proprietary tag, which the OFX spec writes
 * with a dotted prefix and other readers skip.
 */
const PENDING_MARK = /<BANKSYNC\.PENDING>\s*Y/i;

export function parseOfx(text: string): ParsedStatement {
  const currency = ofxTag(text, 'CURDEF') ?? 'USD';
  const accountNumber = ofxTag(text, 'ACCTID') ?? 'Unknown';
  const institution = ofxTag(text, 'ORG');
  const transactions: ParsedTransaction[] = [];
  const blocks =
    text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>|$)/gi) ?? [];
  for (const block of blocks) {
    const date = ofxDate(ofxTag(block, 'DTPOSTED')) ?? ofxDate(ofxTag(block, 'DTUSER'));
    const amount = Number.parseFloat((ofxTag(block, 'TRNAMT') ?? '').replace(',', '.'));
    if (!(date && Number.isFinite(amount))) continue;
    const name = ofxTag(block, 'NAME') ?? ofxTag(block, 'PAYEE') ?? '';
    const memo = ofxTag(block, 'MEMO') ?? '';
    transactions.push({
      transactionDate: date,
      documentNumber: ofxTag(block, 'FITID') ?? ofxTag(block, 'CHECKNUM'),
      counterpartyName: name || memo || '',
      paymentPurpose: memo || name,
      ...(amount < 0 ? { debit: Math.abs(amount) } : { credit: amount }),
      currency,
      ...(PENDING_MARK.test(block) ? { pending: true } : {}),
    });
  }
  const dates = transactions.map(t => t.transactionDate.getTime());
  const balanceEnd = Number.parseFloat(ofxTag(text, 'BALAMT') ?? '');
  return {
    metadata: {
      accountNumber,
      currency,
      institution,
      dateFrom:
        ofxDate(ofxTag(text, 'DTSTART')) ??
        new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo:
        ofxDate(ofxTag(text, 'DTEND')) ?? new Date(dates.length ? Math.max(...dates) : Date.now()),
      ...(Number.isFinite(balanceEnd) ? { balanceEnd } : {}),
    },
    transactions,
  };
}

/* ----------------------------------------------------------------------- */
/* QIF                                                                       */
/* ----------------------------------------------------------------------- */

export { parseQif } from './qif-format.util';

/* ----------------------------------------------------------------------- */
/* camt.052 / camt.053 / camt.054 (ISO 20022)                                */
/* ----------------------------------------------------------------------- */

export { parseCamt053 } from './camt-format.util';

/* ----------------------------------------------------------------------- */
/* MT940                                                                     */
/* ----------------------------------------------------------------------- */

const mt940Date = (yymmdd: string): Date | null => {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(yymmdd);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  return new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[3])));
};

const mt940Amount = (value: string): number => Number.parseFloat(value.replace(',', '.'));

export function parseMt940(text: string): ParsedStatement {
  // Fields span lines until the next ":NN:" tag.
  const unfolded = text.replace(/\r?\n(?!:\d{2}[A-Z]?:|-\s*$)/g, '\n');
  const fields: Array<{ tag: string; value: string }> = [];
  for (const match of unfolded.matchAll(
    /:(\d{2}[A-Z]?):([\s\S]*?)(?=\n:\d{2}[A-Z]?:|\n-\s*$|$)/g,
  )) {
    fields.push({ tag: match[1], value: match[2].trim() });
  }
  const field = (tag: string) => fields.find(item => item.tag === tag)?.value;
  const accountNumber = (field('25') ?? 'Unknown').split('/')[0].trim();
  const opening = field('60F') ?? field('60M') ?? '';
  const closing = field('62F') ?? field('62M') ?? '';
  const balance = (value: string) => {
    const match = /^([CD])(\d{6})([A-Z]{3})([\d,.]+)/.exec(value);
    if (!match) return { amount: undefined, currency: undefined };
    const amount = mt940Amount(match[4]);
    return { amount: match[1] === 'D' ? -amount : amount, currency: match[3] };
  };
  const openingBalance = balance(opening);
  const closingBalance = balance(closing);
  const currency = openingBalance.currency ?? closingBalance.currency ?? 'EUR';

  const transactions: ParsedTransaction[] = [];
  for (let i = 0; i < fields.length; i += 1) {
    if (fields[i].tag !== '61') continue;
    const line = fields[i].value;
    const match = /^(\d{6})(\d{4})?(R?[CD])([A-Z])?([\d,]+)([A-Z]{4})([^/\n]*)(?:\/\/(.*))?/.exec(
      line.replace(/\n.*/s, ''),
    );
    if (!match) continue;
    const date = mt940Date(match[1]);
    const amount = mt940Amount(match[5]);
    if (!(date && Number.isFinite(amount))) continue;
    const isDebit = match[3].endsWith('D');
    const info = fields[i + 1]?.tag === '86' ? fields[i + 1].value.replace(/\s+/g, ' ') : '';
    // Structured :86: (German banks): ?20..?29 purpose, ?32/?33 counterparty name.
    const structured = info.includes('?');
    const purpose = structured
      ? (info.match(/\?2\d([^?]*)/g) ?? [])
          .map(part => part.slice(3).trim())
          .join(' ')
          .trim()
      : info;
    const counterparty = structured
      ? (info.match(/\?3[23]([^?]*)/g) ?? [])
          .map(part => part.slice(3).trim())
          .join(' ')
          .trim()
      : '';
    transactions.push({
      transactionDate: date,
      documentNumber: (match[7] ?? '').trim() || undefined,
      counterpartyName: counterparty || purpose || match[6] || '',
      paymentPurpose: purpose || info,
      ...(isDebit ? { debit: amount } : { credit: amount }),
      currency,
    });
  }
  const dates = transactions.map(t => t.transactionDate.getTime());
  return {
    metadata: {
      accountNumber,
      currency,
      dateFrom: new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo: new Date(dates.length ? Math.max(...dates) : Date.now()),
      balanceStart: openingBalance.amount,
      balanceEnd: closingBalance.amount,
    },
    transactions,
  };
}
