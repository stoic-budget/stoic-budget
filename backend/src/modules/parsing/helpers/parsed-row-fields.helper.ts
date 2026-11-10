import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';

/**
 * What a stored row takes from its parsed line as read, before any
 * classification: the date, the bank's own reference and counterparty details,
 * and whether the bank still holds the row as pending (a bank-sync feed only).
 */
export function parsedRowFields(parsed: ParsedTransaction) {
  return {
    transactionDate: parsed.transactionDate,
    documentNumber: parsed.documentNumber,
    counterpartyBin: parsed.counterpartyBin,
    counterpartyAccount: parsed.counterpartyAccount,
    counterpartyBank: parsed.counterpartyBank,
    isPending: parsed.pending === true,
  };
}
