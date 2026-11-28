import { decodeEntities } from '../helpers/markup-entities.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';

/**
 * ISO 20022 cash statements: camt.053 (statement), camt.052 (intraday report)
 * and camt.054 (debit/credit notification). All three hold the same `Ntry`
 * records; only the wrapper (`Stmt`, `Rpt`, `Ntfctn`) differs.
 *
 * One `Ntry` is one booking, but a bank may book a batch (several payments
 * collected or sent together) as one entry with a `TxDtls` per payment. Such
 * an entry becomes one row per payment when every payment states its amount
 * and they add up to the entry; otherwise it stays one row.
 */

function xmlTag(block: string, tag: string): string | undefined {
  const match = new RegExp(
    `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
    'i',
  ).exec(block);
  return match ? decodeEntities(match[1].trim()) : undefined;
}

function xmlBlocks(text: string, tag: string): string[] {
  return (
    text.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?</(?:\\w+:)?${tag}>`, 'gi')) ??
    []
  );
}

const firstBlock = (text: string, tag: string): string => xmlBlocks(text, tag)[0] ?? '';

function xmlAttr(block: string, tag: string, attr: string): string | undefined {
  const match = new RegExp(`<(?:\\w+:)?${tag}\\s[^>]*${attr}="([^"]*)"`, 'i').exec(block);
  return match ? match[1] : undefined;
}

/** The amount and currency of the first `Amt` element in a block. */
function amountOf(block: string): { value: number; currency?: string } | null {
  const value = Number.parseFloat(xmlTag(block, 'Amt') ?? '');
  return Number.isFinite(value) ? { value, currency: xmlAttr(block, 'Amt', 'Ccy') } : null;
}

/** A reference banks fill in when they have none; it identifies nothing. */
const realReference = (value: string | undefined): string | undefined =>
  value && !/^NOT\s*PROVIDED$/i.test(value) ? value : undefined;

/** Blocks inside a payment whose own `Amt` is not the payment's amount (charges, tax, interest). */
const NESTED_AMOUNTS = /<(?:\w+:)?(AmtDtls|Chrgs|Intrst|Tax|RmtInf)[\s>][\s\S]*?<\/(?:\w+:)?\1>/gi;

/** The amount one payment of a batch states: its own `Amt`, or the instructed one. */
function detailAmount(detail: string): { value: number; currency?: string } | null {
  return (
    amountOf(detail.replace(NESTED_AMOUNTS, '')) ??
    amountOf(firstBlock(firstBlock(detail, 'AmtDtls'), 'TxAmt'))
  );
}

type Side = 'DBIT' | 'CRDT';

/** Who was on the other side of a payment, the party behind an intermediary first. */
function counterpartyOf(detail: string, side: Side) {
  const parties = firstBlock(detail, 'RltdPties');
  const role = side === 'DBIT' ? 'Cdtr' : 'Dbtr';
  const name =
    xmlTag(firstBlock(parties, `Ultmt${role}`), 'Nm') ?? xmlTag(firstBlock(parties, role), 'Nm');
  const account = firstBlock(parties, `${role}Acct`);
  const agent = firstBlock(firstBlock(detail, 'RltdAgts'), `${role}Agt`);
  return {
    name: name ?? xmlTag(parties, 'Nm'),
    account: xmlTag(account, 'IBAN') ?? xmlTag(firstBlock(account, 'Othr'), 'Id'),
    bank: xmlTag(agent, 'BICFI') ?? xmlTag(agent, 'BIC') ?? xmlTag(agent, 'Nm'),
  };
}

function purposeOf(detail: string): string {
  const remittance = xmlBlocks(detail, 'RmtInf');
  const unstructured = remittance
    .flatMap(block => xmlBlocks(block, 'Ustrd').map(item => xmlTag(item, 'Ustrd') ?? ''))
    .join(' ')
    .trim();
  if (unstructured) return unstructured;
  const structured = remittance
    .flatMap(block => xmlBlocks(block, 'CdtrRefInf').map(item => xmlTag(item, 'Ref') ?? ''))
    .join(' ')
    .trim();
  return structured || xmlTag(detail, 'AddtlTxInf') || '';
}

function entryDate(entry: string): Date | null {
  const booked = firstBlock(entry, 'BookgDt');
  const text =
    xmlTag(booked || firstBlock(entry, 'ValDt'), 'Dt') ??
    xmlTag(booked || firstBlock(entry, 'ValDt'), 'DtTm');
  if (!text) return null;
  const date = new Date(text.length === 10 ? `${text}T00:00:00Z` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The payments of an entry with their amounts, or null when it stays one row. */
function batchPayments(total: { value: number; currency?: string }, details: string[]) {
  if (details.length < 2) return null;
  const payments = details.map(detail => ({ detail, amount: detailAmount(detail) }));
  const foreign = (currency?: string) => currency && total.currency && currency !== total.currency;
  if (payments.some(({ amount }) => !amount || foreign(amount.currency))) return null;
  const sum = payments.reduce((acc, payment) => acc + (payment.amount?.value ?? 0), 0);
  return Math.abs(sum - total.value) < 0.005 ? payments : null;
}

function entryRows(entry: string, statementCurrency: string): ParsedTransaction[] {
  const amount = amountOf(entry);
  const date = entryDate(entry);
  if (!(amount && date)) return [];
  const side: Side = (xmlTag(entry, 'CdtDbtInd') ?? '').toUpperCase() === 'DBIT' ? 'DBIT' : 'CRDT';
  const entryReference = realReference(xmlTag(entry, 'AcctSvcrRef'));
  const entryInfo = xmlTag(entry, 'AddtlNtryInf') ?? '';
  const details = xmlBlocks(entry, 'TxDtls');
  // `whole`: one row stands for several payments, so one payment's account is not its account.
  const row = (
    detail: string,
    value: number,
    currency?: string,
    reference?: string,
    whole = false,
  ) => {
    const counterparty = {
      ...counterpartyOf(detail, side),
      ...(whole && { account: '', bank: '' }),
    };
    const purpose = purposeOf(detail) || entryInfo;
    return {
      transactionDate: date,
      documentNumber: reference,
      counterpartyName: counterparty.name || purpose || '',
      ...(counterparty.account && { counterpartyAccount: counterparty.account }),
      ...(counterparty.bank && { counterpartyBank: counterparty.bank }),
      paymentPurpose: purpose || counterparty.name || '',
      ...(side === 'DBIT' ? { debit: value } : { credit: value }),
      currency: currency ?? statementCurrency,
    };
  };

  const payments = batchPayments(amount, details);
  if (!payments) {
    const detail = details[0] ?? entry;
    const reference = entryReference ?? realReference(xmlTag(detail, 'EndToEndId'));
    return [row(detail, amount.value, amount.currency, reference, details.length > 1)];
  }
  // Import sessions and bank sync match duplicates on the reference with the
  // date, so every payment of a batch gets its own: the bank's, or the entry's numbered.
  const seen = new Set<string>();
  return payments.map(({ detail, amount: own }, index) => {
    const refs = firstBlock(detail, 'Refs');
    let reference =
      realReference(xmlTag(refs, 'AcctSvcrRef')) ?? realReference(xmlTag(refs, 'EndToEndId'));
    if (!reference || seen.has(reference) || reference === entryReference) {
      reference = entryReference ? `${entryReference}/${index + 1}` : undefined;
    }
    if (reference) seen.add(reference);
    return row(detail, own?.value ?? 0, own?.currency ?? amount.currency, reference);
  });
}

export function parseCamt053(text: string): ParsedStatement {
  const statement =
    xmlBlocks(text, 'Stmt')[0] ?? xmlBlocks(text, 'Rpt')[0] ?? xmlBlocks(text, 'Ntfctn')[0] ?? text;
  const accountBlock = firstBlock(statement, 'Acct');
  const accountNumber = xmlTag(accountBlock, 'IBAN') ?? xmlTag(accountBlock, 'Id') ?? 'Unknown';
  const currency = xmlTag(accountBlock, 'Ccy') ?? xmlAttr(statement, 'Amt', 'Ccy') ?? 'EUR';
  const transactions = xmlBlocks(statement, 'Ntry').flatMap(entry => entryRows(entry, currency));
  const balances = xmlBlocks(statement, 'Bal');
  const balanceOf = (code: string) => {
    const block = balances.find(item => (xmlTag(item, 'Cd') ?? '').toUpperCase() === code);
    if (!block) return undefined;
    const value = Number.parseFloat(xmlTag(block, 'Amt') ?? '');
    if (!Number.isFinite(value)) return undefined;
    return (xmlTag(block, 'CdtDbtInd') ?? '').toUpperCase() === 'DBIT' ? -value : value;
  };
  const period = firstBlock(statement, 'FrToDt');
  const dates = transactions.map(t => t.transactionDate.getTime());
  const from = xmlTag(period, 'FrDtTm');
  const to = xmlTag(period, 'ToDtTm');
  return {
    metadata: {
      accountNumber,
      currency,
      institution: xmlTag(firstBlock(accountBlock, 'Svcr'), 'Nm'),
      dateFrom: from ? new Date(from) : new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo: to ? new Date(to) : new Date(dates.length ? Math.max(...dates) : Date.now()),
      balanceStart: balanceOf('OPBD'),
      balanceEnd: balanceOf('CLBD'),
    },
    transactions,
  };
}
