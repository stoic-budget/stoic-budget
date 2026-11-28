import type { SubscriptionChargeCandidates, SubscriptionDetail } from '@/app/lib/contracts';

export type CandidateRow = SubscriptionChargeCandidates[number];

/** A payment shown in the list: saved (the card) or still to be saved (the form). */
export type PaymentEntry = {
  key: string;
  date: string;
  amount: number;
  currency: string;
  /** Comes from a bank row rather than typed in. */
  linked: boolean;
};

export interface SubscriptionPaymentsProps {
  payments: PaymentEntry[];
  vendorName: string;
  /** The saved subscription: its refused rows stay out, and a row can be refused. */
  subscriptionId?: string;
  /** Prefills the amount of a payment typed in: the subscription's price. */
  defaultAmount: number | '';
  /** Rows picked in the form but not saved yet, kept out of the picker. */
  pickedTransactionIds?: string[];
  onAddManual: (date: string, amount: number) => void | Promise<void>;
  onAddRows: (rows: CandidateRow[]) => void | Promise<void>;
  /** Payees whose new rows the server adds on its own; the card only. */
  autoLinkPayees?: SubscriptionDetail['autoLinkPayees'];
  /** Links a typed-in payment to a bank row; the card only. */
  onLinkRow?: (paymentKey: string, row: CandidateRow) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
}
