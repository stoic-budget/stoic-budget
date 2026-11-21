import { indianRailType } from '@/modules/parsing/helpers/statement-india-rails.helper';

describe('indianRailType', () => {
  it.each([
    ['UPI/P2A/360872435577/MEMBER/Paytm', true, 'bank_transfer_in'],
    ['NEFT DR-UBIN0500000-MEMBER-NETBANK', false, 'bank_transfer_out'],
    ['IMPS-818411585956-MEMBER-HDF', true, 'bank_transfer_in'],
    ['POS 416021XXXXXX1000 ACME STORE', false, 'card'],
    ['ATW-416021XXXXXX1000-ACME ATM', false, 'cash'],
    ['ACH D- TP ACH HOME-105909750', false, 'direct_debit'],
    ['CREDIT INTEREST CAPITALISED', true, 'interest'],
  ])('types %s', (narration, isCredit, paymentType) => {
    expect(indianRailType(narration, isCredit)).toBe(paymentType);
  });

  it('knows nothing of a narration without a rail', () => {
    expect(indianRailType('GM1TSA/MY0326/19', true)).toBeNull();
  });
});
