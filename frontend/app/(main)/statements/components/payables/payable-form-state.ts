import type { RecurrenceRule, StorageTag } from '@/app/lib/contracts';
import type {
  CreatePayableInput,
  Payable,
  PayableSource,
  PayableStatus,
} from '@/app/lib/payables-api';
import { emptyRepeat, type RepeatDraft, toRecurrenceRule, toRepeatDraft } from './recurrence-draft';

/** What the payable drawer's fields hold, and how a bill or a prefill fills them. */
export interface PayableFormState {
  vendor: string;
  amount: string;
  currency: string;
  dueDate: string;
  source: PayableSource;
  status: PayableStatus;
  comment: string;
  tags: StorageTag[];
  repeat: RepeatDraft;
  remindDaysBefore: string;
}

export const createEmptyState = (defaultCurrency: string): PayableFormState => ({
  vendor: '',
  amount: '',
  currency: defaultCurrency,
  dueDate: '',
  source: 'manual',
  status: 'to_pay',
  comment: '',
  tags: [],
  repeat: emptyRepeat(),
  remindDaysBefore: '3',
});

export const toFormState = (
  payable: Payable | null | undefined,
  initialValues: CreatePayableInput | null | undefined,
  defaultCurrency: string,
): PayableFormState => {
  if (!(payable || initialValues)) {
    return createEmptyState(defaultCurrency);
  }

  if (!payable && initialValues) {
    return {
      vendor: initialValues.vendor || '',
      amount: String(initialValues.amount ?? ''),
      currency: initialValues.currency || defaultCurrency,
      dueDate: initialValues.dueDate ? initialValues.dueDate.slice(0, 10) : '',
      source: initialValues.source || 'manual',
      status: initialValues.status || 'to_pay',
      comment: initialValues.comment || '',
      tags: [],
      repeat: emptyRepeat(),
      remindDaysBefore: '3',
    };
  }

  return {
    vendor: payable?.vendor || '',
    amount: String(payable?.amount ?? ''),
    currency: payable?.currency || defaultCurrency,
    dueDate: payable?.dueDate ? payable.dueDate.slice(0, 10) : '',
    source: payable?.source || 'manual',
    status: payable?.status || 'to_pay',
    comment: payable?.comment || '',
    tags: [...(payable?.tags ?? [])],
    repeat: toRepeatDraft(payable?.recurrence),
    remindDaysBefore: String(payable?.remindDaysBefore ?? 3),
  };
};

/**
 * The repeat and reminder fields of the request. A series is anchored on its
 * occurrence's own day, not on a due date moved off a weekend; ending the
 * repeat of a bill that had one sends null.
 */
export function repeatPayload(
  form: PayableFormState,
  payable: Payable | null | undefined,
): { recurrence?: RecurrenceRule | null; remindDaysBefore?: number } {
  const remind = Number(form.remindDaysBefore);
  const remindDaysBefore =
    Number.isInteger(remind) && remind >= 0 && remind <= 60 ? remind : undefined;
  const anchor = payable?.occurrenceDate ?? form.dueDate;
  const rule = toRecurrenceRule(form.repeat, anchor);
  if (rule) return { recurrence: rule, remindDaysBefore };
  return payable?.recurrence && form.repeat.frequency === 'none'
    ? { recurrence: null, remindDaysBefore }
    : { remindDaysBefore };
}

/** A repeating bill needs a due date and usable numbers before it can be saved. */
export function repeatIsComplete(form: PayableFormState, payable: Payable | null | undefined) {
  return (
    form.repeat.frequency === 'none' ||
    toRecurrenceRule(form.repeat, payable?.occurrenceDate ?? form.dueDate) !== null
  );
}
