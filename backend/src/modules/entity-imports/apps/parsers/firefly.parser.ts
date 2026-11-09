import type { WalletType } from '../../../../entities/wallet.entity';
import { normalizeCurrencyCode } from '../../helpers/import-values';
import { parseAppAmount } from '../app-amounts';
import { cellOf, type DetectedFormat } from '../app-formats';
import { type AppProblem, type AppTxn, appTxn } from '../app-model';

/**
 * Firefly III's transaction export, read from its source
 * (`app/Support/Export/ExportDataGenerator.php`, `exportTransactions`): one row
 * per journal with user_id, group_id, journal_id, created_at, updated_at,
 * group_title, type, currency_code, amount, foreign_currency_code,
 * foreign_amount, …, description, date, source_name, source_iban, source_type,
 * destination_name, destination_iban, destination_type, reconciled, category,
 * budget, bill, tags, notes and the meta fields.
 *
 * `type` is one of `Withdrawal`, `Deposit`, `Transfer`, `Opening balance`,
 * `Reconciliation` (app/Enums/TransactionTypeEnum.php). Amounts are rounded
 * with a decimal point, negative for a withdrawal and positive otherwise, and
 * an opening balance is negative when its source is an asset. `date` is an
 * ATOM timestamp. A transfer is one row naming both accounts; journals sharing
 * a group_id are the parts of one split.
 */
const OWN_TYPES: Record<string, WalletType> = {
  'asset account': 'checking',
  'default account': 'checking',
  loan: 'loan',
  debt: 'loan',
  mortgage: 'loan',
  'credit card': 'credit_card',
};

const isOwn = (type: string) => type.toLowerCase() in OWN_TYPES;

export function parseFirefly(
  fileName: string,
  format: DetectedFormat,
  rows: string[][],
): { txns: AppTxn[]; problems: AppProblem[] } {
  const cell = (row: string[], name: string) => cellOf(row, format.columns, name);
  const journalsPerGroup = new Map<string, number>();
  for (const row of rows) {
    const group = cell(row, 'group_id');
    journalsPerGroup.set(group, (journalsPerGroup.get(group) ?? 0) + 1);
  }
  const txns: AppTxn[] = [];
  const problems: AppProblem[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const type = cell(row, 'type').toLowerCase();
    const date = /^(\d{4}-\d{2}-\d{2})/.exec(cell(row, 'date'))?.[1] ?? null;
    const value = parseAppAmount(cell(row, 'amount'), '.');
    const size = Math.abs(value ?? 0);
    const source = { name: cell(row, 'source_name'), type: cell(row, 'source_type') };
    const target = { name: cell(row, 'destination_name'), type: cell(row, 'destination_type') };
    if (!date) {
      problems.push({ fileName, row: line, reason: 'date' });
      return;
    }
    if (!size) {
      problems.push({ fileName, row: line, reason: 'amount' });
      return;
    }
    // The side that is one of the user's own accounts, and what moved on it.
    let side: { name: string; type: string; amount: number; payee: string } | null = null;
    if (type === 'withdrawal') {
      side = { ...source, amount: -size, payee: target.name };
    } else if (type === 'deposit') {
      side = { ...target, amount: size, payee: source.name };
    } else if (type === 'transfer') {
      side = { ...source, amount: -size, payee: target.name };
    } else if (type === 'opening balance' || type === 'reconciliation') {
      side = isOwn(source.type)
        ? { ...source, amount: -size, payee: target.name }
        : { ...target, amount: size, payee: source.name };
    }
    if (!(side?.name && isOwn(side.type))) {
      problems.push({ fileName, row: line, reason: side ? 'account' : 'type' });
      return;
    }
    const groupId = cell(row, 'group_id');
    const description = cell(row, 'description');
    const currency = normalizeCurrencyCode(cell(row, 'currency_code'));
    const foreign = parseAppAmount(cell(row, 'foreign_amount'), '.');
    const foreignCurrency = normalizeCurrencyCode(cell(row, 'foreign_currency_code'));
    const transfer = type === 'transfer';
    txns.push(
      appTxn({
        fileName,
        row: line,
        account: side.name,
        date,
        amount: side.amount,
        // Firefly's description is what the row is called; the counter account is a fallback.
        payee: transfer ? side.payee : description || side.payee,
        memo: cell(row, 'notes'),
        category: transfer ? null : cell(row, 'category') || null,
        transferTo: transfer ? target.name : null,
        arrived: transfer
          ? foreign && foreignCurrency
            ? { amount: Math.abs(foreign), currency: foreignCurrency }
            : { amount: size, currency }
          : null,
        splitKey:
          !transfer && (journalsPerGroup.get(groupId) ?? 0) > 1 ? `${fileName}#g${groupId}` : null,
        opening: type === 'opening balance',
        currency,
        accountType: OWN_TYPES[side.type.toLowerCase()] ?? null,
      }),
    );
  });
  return { txns, problems };
}

/** The wallet type of a transfer's receiving account, by the row's destination type. */
export function fireflyAccountTypes(
  format: DetectedFormat,
  rows: string[][],
): Map<string, WalletType> {
  const types = new Map<string, WalletType>();
  for (const row of rows) {
    for (const prefix of ['source', 'destination']) {
      const name = cellOf(row, format.columns, `${prefix}_name`);
      const type = OWN_TYPES[cellOf(row, format.columns, `${prefix}_type`).toLowerCase()];
      if (name && type && !types.has(name)) {
        types.set(name, type);
      }
    }
  }
  return types;
}
