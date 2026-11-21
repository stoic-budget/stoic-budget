import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import {
  FrostParser,
  frostSummary,
  isFrostStatement,
  readFrostRows,
} from '@/modules/parsing/parsers/frost.parser';

const STATEMENT = [
  'P.O. Box 16509 Fort Worth, Texas 76162 Member FDIC',
  '¬F_¬R_¬O_¬S_¬T_¬ _¬C_¬H_¬E_¬C_¬K_¬I_¬N_¬G_¬ _¬:_¬ _¬A_¬C_¬C_¬O_¬U_¬N_¬T_¬ _¬N_¬O_¬._¬ _¬6_¬0_¬ _¬1_¬0_¬0_¬0_¬0_¬0_¬1',
  '_ _ B_A_L_AN_CE_ _LA_S_T _S_TA_T_EM_E_NT_ _ _ _| _ _N_O._ _ |_ _A_MO_U_NT_ _|_ _BA_L_AN_C_E _T_HI_S_',
  '_ _ 8 4_ ,_ 3 8_ 5_ . 4_ 6_ _ _| _ _ _ 1 3_ _ | _ _ 3 7_ 8_ , 2_ 0_ 7 ._ 4_ 3 _| _ _ 5_ 1 ,_ 2_ 2 8_ ._ 9 3_ _',
].join('\n');

const line = (y: number, text: string): PdfTextRow => ({ page: 1, y, text, items: [] });

describe('FrostParser', () => {
  it('knows its statement by the address line and the ruled account line', () => {
    expect(isFrostStatement(STATEMENT)).toBe(true);
    expect(isFrostStatement('WIRE TRANSFER FROST BANK WIRE IN')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FrostParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FROST)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CHASE)).resolves.toBe(false);
    await expect(claims(BankName.FROST, FileType.CSV)).resolves.toBe(false);
  });

  it('reads the summary box cell by cell, its figures of money only', () => {
    expect(frostSummary(STATEMENT)).toEqual([84385.46, 378207.43, 51228.93]);
  });

  it('reads each list line by line, signed by its heading, up to the daily balances', () => {
    const rows = [
      line(10, '---------- DEPOSITS/CREDITS ----------'),
      line(20, '09-23 TELLER DEPOSIT 19,800.00 | 09-27 TELLER DEPOSIT 9,900.00'),
      line(30, '09-03 24,493.33 WIRE TRANSFER EXAMPLE BANK WIRE IN 05469'),
      line(40, '---------- CHECKS PAID ----------'),
      line(50, '09-30 8753 # 11,806.07 | 09-03 8773 * # 11,140.00 | 09-24 8779 # 6,115.00'),
      line(60, '---------- OTHER WITHDRAWALS/DEBITS ----------'),
      line(70, '09-05 35.00 NSF FEE'),
      line(80, '---------- DAILY BALANCE ----------'),
      line(90, '08-30 84,385.46 | 09-10 2,239.14'),
    ];
    expect(readFrostRows(rows).map(row => [row.dateText, row.description, row.credit, row.debit])).toEqual([
      ['09-23', 'TELLER DEPOSIT', 19800, undefined],
      ['09-27', 'TELLER DEPOSIT', 9900, undefined],
      ['09-03', 'WIRE TRANSFER EXAMPLE BANK WIRE IN 05469', 24493.33, undefined],
      ['09-30', 'CHECK 8753', undefined, 11806.07],
      ['09-03', 'CHECK 8773', undefined, 11140],
      ['09-24', 'CHECK 8779', undefined, 6115],
      ['09-05', 'NSF FEE', undefined, 35],
    ]);
  });
});
