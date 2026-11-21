import { ukCodeEntry } from '@/modules/parsing/helpers/statement-uk-codes.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 0, 20),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('ukCodeEntry', () => {
  it.each([
    ['CR ACME LTD', { credit: 65 }, 'ACME LTD', 'bank_transfer_in'],
    ['BP ACME-ENERGY', { debit: 620 }, 'ACME-ENERGY', 'bank_transfer_out'],
    ['DD ACME WATER', { debit: 30 }, 'ACME WATER', 'direct_debit'],
    ['SO MEMBER TWO', { debit: 50 }, 'MEMBER TWO', 'standing_order'],
    ['VIS ACME STORE', { debit: 4.2 }, 'ACME STORE', 'card'],
    ['))) ACME CAFE', { debit: 3.1 }, 'ACME CAFE', 'card'],
    ['TFR MEMBER ONE', { credit: 100 }, 'MEMBER ONE', 'bank_transfer_in'],
    ['TFR MEMBER ONE', { debit: 100 }, 'MEMBER ONE', 'bank_transfer_out'],
    ['ACME RECRUITMENT L BGC', { credit: 520.87 }, 'ACME RECRUITMENT L', 'bank_transfer_in'],
    ['BP SAMPLETOWN S/STN DEB', { debit: 24.35 }, 'BP SAMPLETOWN S/STN', 'card'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(ukCodeEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });

  it('leaves a row without a known code as it is', () => {
    const plain = row('ACME STORE LONDON', { debit: 1 });
    expect(ukCodeEntry(plain)).toBe(plain);
    expect(ukCodeEntry(row('XYZ ACME', { debit: 1 })).paymentType).toBeUndefined();
  });
});
