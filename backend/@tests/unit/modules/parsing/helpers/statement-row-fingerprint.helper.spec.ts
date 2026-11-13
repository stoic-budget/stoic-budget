import type { Transaction } from '@/entities/transaction.entity';
import { statementRowFingerprint } from '@/modules/parsing/helpers/statement-row-fingerprint.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { TransactionFingerprintService } from '@/modules/transactions/services/transaction-fingerprint.service';

const service = new TransactionFingerprintService({} as never);

const transaction = {
  workspaceId: 'workspace-1',
  transactionDate: new Date('2026-10-12'),
  amount: 100,
  debit: 100,
  credit: null,
  currency: 'USD',
  counterpartyName: 'Zeta Market',
} as unknown as Transaction;

const parsed = (extra: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  transactionDate: new Date('2026-10-12'),
  counterpartyName: 'Zeta Market',
  paymentPurpose: 'Zeta Market',
  debit: 100,
  ...extra,
});

const fingerprintOf = (row: ParsedTransaction, log = vi.fn()) =>
  statementRowFingerprint(service, { transaction, parsed: row, index: 0 }, 'Pay Checking', log);

describe('statementRowFingerprint', () => {
  it('reads the counterparty when the parsed row names nothing else', () => {
    expect(fingerprintOf(parsed())).toBe(service.generateFingerprint(transaction, 'Pay Checking'));
  });

  it('reads fingerprintMerchant in place of the counterparty', () => {
    const first = fingerprintOf(parsed({ fingerprintMerchant: 'transfer one' }));
    const second = fingerprintOf(parsed({ fingerprintMerchant: 'transfer two' }));

    expect(first).toBe(
      service.generateFingerprint(
        { ...transaction, counterpartyName: 'transfer one' } as Transaction,
        'Pay Checking',
      ),
    );
    expect(second).not.toBe(first);
    expect(first).not.toBe(fingerprintOf(parsed()));
    expect(fingerprintOf(parsed({ fingerprintMerchant: 'transfer one' }))).toBe(first);
  });

  it('answers null and says why when the fingerprint cannot be made', () => {
    const failing = {
      generateFingerprint: () => {
        throw new Error('no date');
      },
    };
    const log = vi.fn();

    const result = statementRowFingerprint(failing, { transaction, parsed: parsed(), index: 2 }, '', log);

    expect(result).toBeNull();
    expect(log).toHaveBeenCalledWith('warn', 'Fingerprint generation failed for transaction 3: no date');
  });
});
