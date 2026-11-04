import { BankName, FileType } from '@/entities/statement.entity';
import {
  CapitecParser,
  capitecPayee,
  capitecPaymentType,
  isCapitecStatement,
} from '@/modules/parsing/parsers/capitec.parser';

const STATEMENT = [
  'Capitec Bank Limited',
  'Savings Account Statement',
  'Posting Date Transaction Date Description Money In (R) Money Out (R) Balance (R)',
].join('\n');

describe('CapitecParser', () => {
  it('knows its statement by the registered name and the table heading', () => {
    expect(isCapitecStatement(STATEMENT)).toBe(true);
    expect(isCapitecStatement('Capitec Bank Limited')).toBe(false);
    expect(isCapitecStatement('Posting Date Transaction Date')).toBe(false);
  });

  it('claims a PDF named Capitec or unnamed, and no other bank', async () => {
    const parser = new CapitecParser();
    expect(await parser.canParse(BankName.CAPITEC, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.CAPITEC, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types a line by how it reads', () => {
    expect(capitecPaymentType('*SMS Notification Fee')).toBe('fee');
    expect(capitecPaymentType('Interest Received')).toBe('interest');
    expect(capitecPaymentType('ATM Cash Withdrawal Example Town (Card 1234)')).toBe('cash');
    expect(capitecPaymentType('Acme Store Example Town (Card 1234)')).toBe('card');
    expect(capitecPaymentType('Banking App Payment Received A Person')).toBe('bank_transfer_in');
    expect(capitecPaymentType('Banking App Transfer to Someone (1234567890)')).toBe(
      'bank_transfer_out',
    );
    expect(capitecPaymentType('*USSD Prepaid Purchase ACME')).toBeNull();
    expect(capitecPaymentType('*Debit Order Dispute Fee (40 Days)')).toBe('fee');
  });

  it('takes the payee out of a line', () => {
    expect(capitecPayee('Acme Store Example Town (Card 1234)')).toBe('Acme Store Example Town');
    expect(capitecPayee('Banking App Payment Received A Person')).toBe('A Person');
    expect(capitecPayee('Payment Received: Example Payer 1234567890')).toBe('Example Payer');
    expect(capitecPayee('Banking App Transfer to Someone (1234567890)')).toBe('Someone');
    expect(capitecPayee('ATM Cash Withdrawal Example Town (Card 1234)')).toBe('');
    expect(capitecPayee('*SMS Notification Fee')).toBe('');
  });
});
