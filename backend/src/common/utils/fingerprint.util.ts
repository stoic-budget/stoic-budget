import { createHash } from 'crypto';

interface FingerprintInput {
  workspaceId: string;
  accountNumber: string;
  date: Date | string;
  amount: number;
  currency: string;
  direction: 'debit' | 'credit';
  merchant: string;
}

/**
 * Generates a deterministic SHA-256 fingerprint for a transaction.
 * Used for duplicate detection across import sessions.
 *
 * @param input Transaction fingerprint input data
 * @returns First 32 characters of SHA-256 hash (hex string)
 */
export function generateTransactionFingerprint(input: FingerprintInput): string {
  // Normalize date to YYYY-MM-DD format
  const dateStr =
    typeof input.date === 'string'
      ? input.date.split('T')[0]
      : input.date.toISOString().split('T')[0];

  // Normalize amount to fixed 2 decimal places
  const amountStr = Number(input.amount).toFixed(2);

  // Normalize merchant: lowercase, trim whitespace, take first 50 chars
  const merchantStr = input.merchant.toLowerCase().trim().substring(0, 50);

  // Normalize currency: uppercase
  const currencyStr = input.currency.toUpperCase();

  // Create deterministic string for hashing
  const fingerprintData = [
    input.workspaceId,
    input.accountNumber,
    dateStr,
    amountStr,
    currencyStr,
    input.direction,
    merchantStr,
  ].join('|');

  // Generate SHA-256 hash and return first 32 characters
  const hash = createHash('sha256').update(fingerprintData).digest('hex');
  return hash.substring(0, 32);
}

/**
 * Normalizes a string for fingerprint generation.
 * Removes extra whitespace, converts to lowercase.
 *
 * @param str String to normalize
 * @returns Normalized string
 */
export function normalizeForFingerprint(str: string): string {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The fingerprint of the n-th identical row of one file (n from 2): two coffees
 * of 3.50 on the same day are two payments, not one printed twice. Uploading
 * the same file again yields the same numbers, so both are still recognised.
 */
export function occurrenceFingerprint(fingerprint: string, occurrence: number): string {
  if (occurrence < 2) {
    return fingerprint;
  }
  return createHash('sha256').update(`${fingerprint}#${occurrence}`).digest('hex').substring(0, 32);
}

/** Gives the second and later identical rows of one file their own fingerprints, in place. */
export function numberRepeats(rows: Array<{ fingerprint?: string | null }>): void {
  const occurrences = new Map<string, number>();
  for (const row of rows) {
    if (row.fingerprint) {
      const occurrence = (occurrences.get(row.fingerprint) ?? 0) + 1;
      occurrences.set(row.fingerprint, occurrence);
      row.fingerprint = occurrenceFingerprint(row.fingerprint, occurrence);
    }
  }
}
