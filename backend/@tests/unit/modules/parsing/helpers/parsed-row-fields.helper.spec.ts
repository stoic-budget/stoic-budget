import { parsedRowFields } from '../../../../../src/modules/parsing/helpers/parsed-row-fields.helper';

describe('parsedRowFields', () => {
  const line = {
    transactionDate: new Date('2026-09-28T00:00:00Z'),
    documentNumber: 'ACT-1:AUTH-1',
    counterpartyName: 'ACME Store - Wireless Buds',
    paymentPurpose: 'card',
    debit: 15,
  };

  it('stores a line the feed marks pending as a pending row', () => {
    expect(parsedRowFields({ ...line, pending: true }).isPending).toBe(true);
  });

  it('stores every other line as a booked row', () => {
    expect(parsedRowFields(line).isPending).toBe(false);
    expect(parsedRowFields(line)).toMatchObject({
      transactionDate: line.transactionDate,
      documentNumber: 'ACT-1:AUTH-1',
    });
  });
});
