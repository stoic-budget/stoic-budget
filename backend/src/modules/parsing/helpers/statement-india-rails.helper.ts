import type { PaymentType } from '../../../contracts/transactions/payment-type';

/**
 * The payment rails Indian banks name at the start of a row's narration,
 * whatever separator follows ("UPI-", "UPI/", "NEFT DR-", "IMPS/P2A/…"): a
 * transfer whose side the money gives, a card payment, cash at an ATM, a
 * standing instruction or loan instalment, a charge.
 */
const RAILS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:UPI|NEFT|IMPS|RTGS|MMT|INB|IB FUNDS TRANSFER|FT)\b/i, 'transfer'],
  [/^(?:POS|PCD|ECOM|VPS|IPS)\b/i, 'card'],
  [/^(?:ATW|NWD|EAW|ATM|CASH WDL|CSH)\b/i, 'cash'],
  [/^(?:ACH D|NACH|ECS|EMI|SI)\b/i, 'direct_debit'],
  [/^(?:IB BILLPAY|BILLPAY|BIL\/)/i, 'bank_transfer_out'],
  [/\bINT(?:EREST)?\.?\s*(?:PD|PAID|CREDIT)\b|^CREDIT INTEREST\b/i, 'interest'],
  [/\b(?:CHRGS?|CHARGES?|FEE)\b/i, 'fee'],
];

export function indianRailType(narration: string, isCredit: boolean): PaymentType | null {
  const text = narration.replace(/\s+/g, ' ').trim();
  const found = RAILS.find(([pattern]) => pattern.test(text))?.[1];
  if (found === 'transfer') {
    return isCredit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  return found ?? null;
}
