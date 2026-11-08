import type {
  ParsedSplit,
  ParsedStatement,
  ParsedTransaction,
} from '../interfaces/parsed-statement.interface';

/**
 * QIF, the Quicken interchange format desktop money programs still export. A
 * file is a run of sections, each opened by a `!` header line: `!Account`
 * names the account the next transaction section belongs to, `!Type:Bank`
 * (Cash, CCard, Oth A, Oth L) holds its transactions, and list sections
 * (`!Type:Cat`, `!Type:Class`, `!Type:Memorized`, ...) are read past. Records
 * end with `^`; every line starts with a one-letter code.
 */

interface RawSplit {
  category?: string;
  memo?: string;
  amount?: string;
}

interface QifRecord {
  fields: Record<string, string>;
  splits: RawSplit[];
}

interface QifAccount {
  name?: string;
  records: QifRecord[];
}

const TRANSACTION_TYPES = /^(bank|cash|ccard|oth\s*[al])$/i;

const emptyRecord = (): QifRecord => ({ fields: {}, splits: [] });

/** One line into the record: S/E/$ build the split parts, the rest are the row's fields. */
function addLine(record: QifRecord, code: string, value: string): void {
  const last = record.splits.at(-1);
  if (code === 'S') {
    record.splits.push({ category: value });
  } else if (code === 'E') {
    if (last && last.memo === undefined && last.amount === undefined) last.memo = value;
    else record.splits.push({ memo: value });
  } else if (code === '$') {
    if (last && last.amount === undefined) last.amount = value;
    else record.splits.push({ amount: value });
  } else if (code !== '%') {
    const field = record.fields[code];
    record.fields[code] = field ? `${field} ${value}` : value;
  }
}

/** The file's accounts with their transaction records, in the order they first appear. */
function readSections(text: string): { accounts: QifAccount[]; investmentRecords: number } {
  const accounts: QifAccount[] = [];
  let account: QifAccount | undefined;
  let mode: 'account' | 'transactions' | 'investment' | 'skip' = 'transactions';
  let record = emptyRecord();
  let investmentRecords = 0;

  const flush = () => {
    const filled = Object.keys(record.fields).length > 0 || record.splits.length > 0;
    if (filled && mode === 'account') {
      // The AutoSwitch list names every account once, and each is named again
      // before its own transactions: the second mention is the same account.
      const name = record.fields.N?.trim() || undefined;
      account = accounts.find(known => name && known.name === name);
      if (!account) {
        account = { name, records: [] };
        accounts.push(account);
      }
    } else if (filled && mode === 'transactions') {
      if (!account) {
        account = { records: [] };
        accounts.push(account);
      }
      account.records.push(record);
    } else if (filled && mode === 'investment') {
      investmentRecords += 1;
    }
    record = emptyRecord();
  };

  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith('!')) {
      flush();
      const header = line.slice(1).trim();
      if (/^account$/i.test(header)) {
        mode = 'account';
      } else if (/^type:/i.test(header)) {
        const type = header.slice(5).trim();
        mode = TRANSACTION_TYPES.test(type)
          ? 'transactions'
          : /^invst$/i.test(type)
            ? 'investment'
            : 'skip';
      }
      // `!Option:AutoSwitch` and `!Clear:AutoSwitch` only bracket the account
      // list, which is read like any other account record.
      continue;
    }
    if (line === '^') {
      flush();
      continue;
    }
    if (mode !== 'skip') addLine(record, line[0], line.slice(1).trim());
  }
  flush();
  return { accounts, investmentRecords };
}

/**
 * QIF dates are ambiguous (MM/DD/YYYY in the US, DD/MM/YYYY elsewhere); the
 * whole file is read first and the order that makes every date valid wins,
 * US first when both do.
 */
function qifDateParser(rows: string[]): (value: string) => Date | null {
  const parts = rows.map(row =>
    row
      .replace(/'/g, '/')
      .split(/[/.-]/)
      .map(part => part.trim()),
  );
  const valid = (order: 'mdy' | 'dmy') =>
    parts.every(part => {
      if (part.length !== 3) return false;
      const [a, b] = part.map(Number);
      return order === 'mdy'
        ? a >= 1 && a <= 12 && b >= 1 && b <= 31
        : b >= 1 && b <= 12 && a >= 1 && a <= 31;
    });
  const order: 'mdy' | 'dmy' = valid('mdy') ? 'mdy' : valid('dmy') ? 'dmy' : 'mdy';
  return value => {
    const part = value
      .replace(/'/g, '/')
      .split(/[/.-]/)
      .map(piece => piece.trim());
    if (part.length !== 3) return null;
    let [a, b, year] = part.map(Number);
    if (part[0].length === 4) {
      // ISO-looking: YYYY-MM-DD
      [year, a, b] = part.map(Number);
      return new Date(Date.UTC(year, a - 1, b));
    }
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const month = order === 'mdy' ? a : b;
    const day = order === 'mdy' ? b : a;
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  };
}

const parseAmount = (value: string | undefined) =>
  Number.parseFloat((value ?? '').replace(/,/g, ''));

const round2 = (value: number) => Math.round(value * 100) / 100;

const money = (value: number) => Math.abs(value).toFixed(2);

/**
 * An `L` or `S` value: `[Savings]` is a transfer to that account, anything else
 * a category whose levels are joined by ':'. A `/Class` suffix is dropped, and
 * so is the `--Split--` placeholder some programs write on a split row.
 */
export function readQifCategory(value: string | undefined): {
  categoryName?: string;
  transferAccount?: string;
} {
  const transfer = /^\s*\[([^\]]*)\]/.exec(value ?? '');
  if (transfer) {
    const account = transfer[1].trim();
    return account ? { transferAccount: account } : {};
  }
  const levels = (value ?? '')
    .split('/')[0]
    .split(':')
    .map(level => level.trim())
    .filter(Boolean);
  const name = levels.join(':');
  return name && name !== '--Split--' ? { categoryName: name } : {};
}

/**
 * The split parts of a row whose amount is `total`. Parts must go the row's
 * way; when they fall short of it, the rest becomes a part without a category.
 * Parts that cannot make up the row (they go both ways, or add up to more)
 * leave it whole. Either case is said in `warnings`.
 */
function readSplits(
  raw: RawSplit[],
  total: number,
  label: string,
  warnings: string[],
): ParsedSplit[] | undefined {
  const parts: ParsedSplit[] = raw
    .map(split => ({
      amount: parseAmount(split.amount),
      ...readQifCategory(split.category),
      ...(split.memo ? { memo: split.memo } : {}),
    }))
    .filter(part => Number.isFinite(part.amount) && Math.abs(part.amount) >= 0.005);
  if (parts.length === 0) return undefined;
  if (parts.some(part => Math.sign(part.amount) !== Math.sign(total))) {
    warnings.push(`${label}: its split parts go both in and out; the row is kept whole`);
    return undefined;
  }
  const sum = round2(parts.reduce((acc, part) => acc + part.amount, 0));
  const rest = round2(total - sum);
  if (Math.abs(rest) >= 0.005) {
    if (Math.sign(rest) !== Math.sign(total)) {
      warnings.push(
        `${label}: its split parts add up to ${money(sum)}, more than the row's ${money(total)}; the row is kept whole`,
      );
      return undefined;
    }
    warnings.push(
      `${label}: its split parts add up to ${money(sum)} of ${money(total)}; the remaining ${money(rest)} is kept as a part without a category`,
    );
    parts.push({ amount: rest });
  }
  return parts.map(part => ({ ...part, amount: Math.abs(part.amount) }));
}

function readAccount(
  account: QifAccount,
  parseDate: (value: string) => Date | null,
  currency: string,
): Pick<ParsedStatement, 'metadata' | 'transactions' | 'warnings'> {
  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = [];
  let balanceStart: number | undefined;
  for (const [index, { fields, splits }] of account.records.entries()) {
    const date = fields.D ? parseDate(fields.D) : null;
    const amount = parseAmount(fields.T ?? fields.U);
    if (!(date && Number.isFinite(amount))) continue;
    const category = readQifCategory(fields.L);
    // Quicken opens an account with a transfer to itself: its opening balance, not a row.
    const ownName = account.name?.toLowerCase();
    if (index === 0 && ownName && category.transferAccount?.toLowerCase() === ownName) {
      balanceStart = amount;
      continue;
    }
    const label = `Row ${index + 1} (${date.toISOString().slice(0, 10)})`;
    const parts = splits.length ? readSplits(splits, amount, label, warnings) : undefined;
    const single = parts?.length === 1 ? parts[0] : undefined;
    const own = category.categoryName || category.transferAccount ? category : (single ?? {});
    transactions.push({
      transactionDate: date,
      documentNumber: fields.N,
      counterpartyName: fields.P || fields.M || '',
      paymentPurpose: fields.M || fields.P || '',
      ...(amount < 0 ? { debit: Math.abs(amount) } : { credit: amount }),
      currency,
      ...(own.categoryName ? { categoryName: own.categoryName } : {}),
      ...(own.transferAccount ? { transferAccount: own.transferAccount } : {}),
      ...(parts && parts.length > 1 ? { splits: parts } : {}),
    });
  }
  const dates = transactions.map(t => t.transactionDate.getTime());
  return {
    metadata: {
      accountNumber: account.name || 'Unknown',
      currency,
      dateFrom: new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo: new Date(dates.length ? Math.max(...dates) : Date.now()),
      ...(balanceStart !== undefined ? { balanceStart } : {}),
    },
    transactions,
    ...(warnings.length ? { warnings } : {}),
  };
}

/**
 * Every account with rows becomes a statement of its own: the first is the
 * result, the rest its `otherAccounts`, as with a PDF that prints several.
 */
export function parseQif(text: string, currency = 'USD'): ParsedStatement {
  const { accounts, investmentRecords } = readSections(text);
  const dates = accounts.flatMap(account => account.records.map(record => record.fields.D ?? ''));
  const parseDate = qifDateParser(dates.filter(Boolean));
  const read = accounts.map(account => readAccount(account, parseDate, currency));
  const withRows = read.filter(account => account.transactions.length > 0);
  const [first, ...others] = withRows.length
    ? withRows
    : [read[0] ?? readAccount({ records: [] }, parseDate, currency)];
  if (investmentRecords > 0) {
    first.warnings = [
      `${investmentRecords} investment records (!Type:Invst) were skipped: investment accounts are not imported from QIF`,
      ...(first.warnings ?? []),
    ];
  }
  return { ...first, ...(others.length ? { otherAccounts: others } : {}) };
}
