import { BankName, FileType } from '@/entities/statement.entity';
import {
  ChimeParser,
  chimePayee,
  chimePaymentType,
  isChimeStatement,
  splitChimeEntry,
} from '@/modules/parsing/parsers/chime.parser';

const STATEMENT = [
  'Checking Account Statement',
  'write to Chime Member Services, P.O. Box 417',
].join('\n');

describe('ChimeParser', () => {
  it('knows its statement by the member services and the title', () => {
    expect(isChimeStatement(STATEMENT)).toBe(true);
    expect(isChimeStatement('Checking Account Statement')).toBe(false);
    expect(isChimeStatement('Transfer from Chime Savings Account\nChecking Account Statement')).toBe(false);
  });

  it('claims a PDF named Chime or unnamed, and no other bank', async () => {
    const parser = new ChimeParser();
    expect(await parser.canParse(BankName.CHIME, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CHIME, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('splits the name from the type, whichever words the name holds', () => {
    expect(splitChimeEntry('Visa Money Transfer - Example Person Deposit VISA MONEY TRANSFER - EXAMPLE PERSON - VISA DEBIT')).toEqual({
      name: 'Visa Money Transfer - Example Person',
      type: 'Deposit',
    });
    expect(splitChimeEntry('Transfer from Example P. Transfer')).toEqual({ name: 'Transfer from Example P.', type: 'Transfer' });
    expect(splitChimeEntry('Round Up to Savings Account Round Up Transfer')).toEqual({
      name: 'Round Up to Savings Account',
      type: 'Round Up Transfer',
    });
    expect(splitChimeEntry('Ck*example person visa direct Deposit CK*EXAMPLE PERSON VISA DIRECT TXUS')?.type).toBe('Deposit');
    expect(splitChimeEntry('Beginning balance')).toBeNull();
  });

  it('types an entry by its type, a transfer by the direction', () => {
    expect(chimePaymentType('Example Shop Purchase EXAMPLE SHOP DALLAS TXUS', false)).toBe('card');
    expect(chimePaymentType('Example Shop Refund EXAMPLE SHOP', true)).toBe('card');
    expect(chimePaymentType('Cash Deposit Deposit', true)).toBe('cash');
    expect(chimePaymentType('Visa Money Transfer - Example Person Deposit VISA MONEY TRANSFER', true)).toBe('bank_transfer_in');
    expect(chimePaymentType('Transfer to Example P. Transfer', false)).toBe('bank_transfer_out');
    expect(chimePaymentType('Transfer from Example P. Transfer', true)).toBe('bank_transfer_in');
    expect(chimePaymentType('Round Up to Savings Account Round Up Transfer', false)).toBe('bank_transfer_out');
    expect(chimePaymentType('Direct Debit: Example Bank, Pay Direct Debit EXAMPLE BANK, PAY, 123', false)).toBe('direct_debit');
  });

  it('takes the name as the payee, without the direction or the debit label', () => {
    expect(chimePayee('Example Shop Purchase EXAMPLE SHOP DALLAS TXUS')).toBe('Example Shop');
    expect(chimePayee('Transfer to Example P. Transfer')).toBe('Example P.');
    expect(chimePayee('Direct Debit: Example Bank, Pay... Direct Debit EXAMPLE BANK, PAY, 123')).toBe('Example Bank, Pay...');
    expect(chimePayee('Beginning balance')).toBe('');
  });
});
