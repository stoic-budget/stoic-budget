import { currencyOr } from '@/app/lib/currency';
import { isPrivateCategory } from '@/app/lib/private-category';
import type { ManualExpenseDraft } from '@/app/lib/statement-expense-drawer';
import type { Transaction } from '../types';

/** The amount as the form shows a typed one, with the currency's cents: 49.9 → "49.90". */
function amountText(value: number, currency: string): string {
  if (!(value > 0)) {
    return '';
  }
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  const text = String(value);
  const decimals = text.split('.')[1]?.length ?? 0;
  // A row more precise than the currency keeps every digit rather than be rounded.
  return decimals < (digits ?? 2) ? value.toFixed(digits) : text;
}

type DraftCategory = { id: string; name?: string | null; type: string; isEnabled?: boolean };
type DraftAccount = { id: string; currency: string; isActive: boolean };

/**
 * Whether "Duplicate" is offered on a row. The copy goes into the manual
 * expense form, so only a plain expense of one's own qualifies:
 * - income: the form records expenses only; copying it there would flip its direction;
 * - a transfer, reimbursement or investment leg: a copy without its other leg
 *   would read as spending that never left the household;
 * - a split part: it is a piece of one payment, and the split leaves no whole row to copy;
 * - a private row: the form cannot make the copy private, so it would land in
 *   front of the whole household (and another member's arrives blanked anyway);
 * - a row a synced crypto wallet brought in: it belongs to that wallet's chain
 *   history, and a hand-made copy would sit outside it under an address for a payee.
 * Rows in the trash never reach a drawer or the list.
 */
export function canDuplicate(tx: Transaction): boolean {
  return (
    tx.transactionType === 'expense' &&
    !tx.transferPairId &&
    !tx.investmentAccountId &&
    !tx.splitGroupId &&
    !tx.cryptoWalletId &&
    !tx.isPrivate
  );
}

/**
 * The manual expense form filled in from a row: amount, currency, merchant,
 * description, and the category and account when the form can offer them
 * (an enabled expense category, an active account in the row's currency).
 * Everything else about the row stays behind; the date is the form's own.
 */
export function duplicateDraft(
  tx: Transaction,
  categories: readonly DraftCategory[],
  accounts: readonly DraftAccount[],
): ManualExpenseDraft {
  const currency = currencyOr(tx.currency);
  const merchant = tx.counterpartyName.trim();
  const purpose = (tx.paymentPurpose ?? '').trim();
  const category = categories.find(
    item =>
      item.id === tx.category?.id &&
      item.type === 'expense' &&
      item.isEnabled !== false &&
      !isPrivateCategory(item),
  );
  const account = accounts.find(
    item => item.id === tx.walletId && item.isActive && item.currency.toUpperCase() === currency,
  );
  return {
    amount: amountText(Number(tx.debit), currency),
    currency,
    merchant,
    // A hand-entered row stores the merchant as its purpose when none was given.
    description: purpose === merchant ? '' : purpose,
    categoryId: category?.id ?? '',
    taxRateId: '',
    walletId: account?.id,
  };
}
