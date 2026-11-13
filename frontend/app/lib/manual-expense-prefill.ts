import type { ManualExpenseDraft } from './statement-expense-drawer';

/**
 * A filled-in manual expense waiting for the form to open: "Duplicate" on a
 * row puts it here and goes to the form, which reads it while it is open.
 * Nothing is saved until the person presses Save in that form.
 *
 * Only a link carrying `duplicate=1` uses it; any other way of opening the
 * form drops it, so a copy never turns up in a later, unrelated "Add".
 */
export const DUPLICATE_PARAM = 'duplicate';

export const DUPLICATE_EXPENSE_HREF = `/statements/submit?openExpenseDrawer=manual&${DUPLICATE_PARAM}=1`;

let pending: ManualExpenseDraft | null = null;

export function stashManualPrefill(draft: ManualExpenseDraft): void {
  pending = { ...draft };
}

/** The waiting draft, as a fresh copy, or null. Read as often as the form needs it. */
export function peekManualPrefill(): ManualExpenseDraft | null {
  return pending ? { ...pending } : null;
}

export function clearManualPrefill(): void {
  pending = null;
}
