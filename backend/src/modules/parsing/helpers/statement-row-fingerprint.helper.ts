import type { Transaction } from '../../../entities/transaction.entity';
import type { TransactionFingerprintService } from '../../transactions/services/transaction-fingerprint.service';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';

/**
 * The fingerprint of a statement row. Fingerprints feed the partial unique
 * index `(workspace_id, fingerprint) WHERE is_duplicate = false`, which is what
 * makes re-uploading an overlapping period idempotent. The parsed row may name
 * what the fingerprint reads in place of the payee (`fingerprintMerchant`). A
 * missing fingerprint only costs dedup, so it never fails the import. A row
 * the bank still holds as pending has none.
 */
export function statementRowFingerprint(
  fingerprints: Pick<TransactionFingerprintService, 'generateFingerprint'>,
  row: { transaction: Transaction; parsed: ParsedTransaction; index: number },
  accountNumber: string,
  log: (level: string, message: string) => void,
): string | null {
  const { transaction, parsed, index } = row;
  // A pending row is matched to its booked version by the bank-sync pull, by
  // the provider's id. Its fingerprint would only mark that booked version a
  // duplicate of a row about to be replaced.
  if (transaction.isPending) return null;
  try {
    return fingerprints.generateFingerprint(
      { ...transaction, fingerprintMerchant: parsed.fingerprintMerchant },
      accountNumber,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log('warn', `Fingerprint generation failed for transaction ${index + 1}: ${reason}`);
    return null;
  }
}
