import { foldText } from './statement-date.helper';

/** Words that ask for a card's payment. */
const PAYMENT_MARKERS = [
  'minimum payment',
  'payment due date',
  'paiement minimum',
  'minimumbetaling',
  'mindestzahlung',
  'pago minimo',
];
const CARD_MARKERS = [
  ...PAYMENT_MARKERS,
  'available credit',
  'credit limit',
  'credit line',
  'cardmember',
  'cardholder',
  'limite de credit',
];

/**
 * A credit card statement prints charges as positive amounts and its balance
 * as what is owed. Bank arithmetic reconciles it just as well with every sign
 * flipped, so only the wording tells the two apart: two of the markers, one of
 * them asking for a payment. A bank account's notes on a credit line ("credit
 * limit", "credit line") ask for none.
 */
export function isCreditCardStatement(text: string): boolean {
  const folded = foldText(text);
  const found = CARD_MARKERS.filter(marker => folded.includes(marker));
  return found.length >= 2 && found.some(marker => PAYMENT_MARKERS.includes(marker));
}
