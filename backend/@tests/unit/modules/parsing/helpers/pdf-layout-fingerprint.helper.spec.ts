import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName } from '@/entities/statement.entity';
import { mentionedBank, statementLayout } from '@/modules/parsing/helpers/pdf-layout-fingerprint.helper';
import { readLayoutTable } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
});

/** A header whose money headings end at 340, 430 and 520, as the rows below print them. */
const header = (...headings: string[]) => {
  const [date, description, first, second, balance] = headings;
  return row(100, [
    [date, 40],
    [description, 110],
    [first, 340 - first.length * 5],
    [second, 430 - second.length * 5],
    [balance, 520 - balance.length * 5],
  ]);
};

const layoutOf = (rows: PdfTextRow[], text = 'Example Bank statement') =>
  statementLayout(readLayoutTable(rows).layout, text);

const statement = (head: PdfTextRow, store: string, amount: string) =>
  layoutOf([
    head,
    row(115, [['01/02/2025', 40], [store, 110], [amount, 340 - amount.length * 5], ['987.50', 490]]),
    // Every page repeats the header: it is one layout.
    { ...head, page: 2 },
  ]);

describe('pdf-layout-fingerprint.helper', () => {
  const usual = header('Date', 'Description', 'Withdrawal', 'Deposit', 'Balance');

  it('gives two statements of one layout the same fingerprint, whatever their rows', () => {
    const one = statement(usual, 'ACME', '12.50');
    const other = statement(usual, 'Example', '7.25');
    expect(one?.fingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(other?.fingerprint).toBe(one?.fingerprint);
    expect(one?.headings).toEqual([
      'date:date | description:description | debit:withdrawal | credit:deposit | balance:balance',
    ]);
  });

  it('changes when a heading is renamed or the money columns swap places', () => {
    const base = statement(usual, 'ACME', '12.50')?.fingerprint;
    const renamed = statement(header('Date', 'Details', 'Withdrawal', 'Deposit', 'Balance'), 'ACME', '12.50');
    const swapped = statement(header('Date', 'Description', 'Deposit', 'Withdrawal', 'Balance'), 'ACME', '12.50');
    expect(renamed?.fingerprint).not.toBe(base);
    expect(swapped?.fingerprint).not.toBe(base);
  });

  it('keeps the header words no heading knows, but no figure or date read with them', () => {
    const layout = layoutOf([
      row(100, [
        ['Seq', 20],
        ['Date', 40],
        ['Description', 110],
        ['Withdrawal', 290],
        ['Deposit', 395],
        ['Balance', 485],
        ['Branch', 540],
        ['31/01/2025', 580],
      ]),
    ]);
    expect(layout?.unknownWords).toEqual(['seq', 'branch']);
    expect(layout?.headings).toEqual([
      'date:date seq | description:description | debit:withdrawal | credit:deposit | balance:balance | other:branch',
    ]);
  });

  it('names a statement laid out in sections by its headings, and none without either', () => {
    const sections = layoutOf([row(100, [['Deposits', 40], ['and', 90], ['Other', 110], ['Additions', 140]])]);
    expect(sections?.headings).toEqual(['section:credit']);
    expect(layoutOf([row(100, [['Dear', 40], ['customer', 70]])])).toBeUndefined();
  });

  it('notes a bank with a parser of its own that the text names', () => {
    expect(mentionedBank('Website: www.bochk.com')).toBe(BankName.BANK_OF_CHINA);
    expect(mentionedBank('BankofScotlandplc.Registeredoffice')).toBe(BankName.BANK_OF_SCOTLAND);
    expect(mentionedBank('barclays bank uk plc. registered in england')).toBe(BankName.BARCLAYS);
    expect(mentionedBank("direct inquiries to: boeing employees' credit union")).toBe(BankName.BECU);
    expect(mentionedBank('bendigo and adelaide bank limited abn 11')).toBe(BankName.BENDIGO);
    expect(mentionedBank('bmo bank n.a. p.o. box 94033')).toBe(BankName.BMO);
    expect(mentionedBank('bnp paribas bank polska s.a. ul. 2')).toBe(BankName.BNP_PARIBAS);
    expect(mentionedBank('bank of queensland limited abn 32')).toBe(BankName.BOQ);
    expect(mentionedBank('bpi express phone 89-100')).toBe(BankName.BPI);
    expect(mentionedBank('www.capitalone.com 1-888')).toBe(BankName.CAPITAL_ONE);
    expect(mentionedBank('capitec bank limited 1 quantum street')).toBe(BankName.CAPITEC);
    expect(mentionedBank('write us at cash disputes, 1955 broadway')).toBe(BankName.CASH_APP);
    expect(mentionedBank('card purchase cash app*example person')).toBeUndefined();
    expect(mentionedBank('send inquiries to charles schwab bank p.o. box')).toBe(BankName.SCHWAB);
    expect(mentionedBank('jpmorgan chase bank, n.a. p o box 182051')).toBe(BankName.CHASE);
    expect(mentionedBank('write to chime member services, p.o. box 417')).toBe(BankName.CHIME);
    expect(mentionedBank('cibc account statement for dec 1 to dec 31')).toBe(BankName.CIBC);
    expect(mentionedBank('your citibank account statement as on aug 1, 2024 ... mobikwik axis bank')).toBe(BankName.CITI);
    expect(mentionedBank('access your account online: citizensbank.com')).toBe(BankName.CITIZENS);
    expect(mentionedBank('your agreement with coast capital savings federal credit union (ccs)')).toBe(BankName.COAST_CAPITAL);
    expect(mentionedBank('visit our web site www.comerica.com')).toBe(BankName.COMERICA);
    expect(mentionedBank('commonwealth bank of australia abn 48 123 123 124')).toBe(BankName.COMMBANK);
    expect(mentionedBank('go to commercebank.com to learn more')).toBe(BankName.COMMERCE_BANK);
    expect(mentionedBank('in account with commercial bank of ceylon')).toBe(BankName.COMMERCIAL_BANK);
    expect(mentionedBank('Crédit Agricole Brie Picardie 500 Rue Saint Fuscien')).toBe(BankName.CREDIT_AGRICOLE);
    expect(mentionedBank('made payable to CREDIT ONE BANK.')).toBe(BankName.CREDIT_ONE);
    expect(mentionedBank('Digital Federal Credit Union 220 Sample Boulevard')).toBe(BankName.DCU);
    expect(mentionedBank('Bank of America, N.A. P.O. Box 25118')).toBe(BankName.BANK_OF_AMERICA);
    expect(mentionedBank('CAISSE DESJARDINS DE SAMPLETOWN')).toBe(BankName.DESJARDINS);
    expect(mentionedBank('Deutsche Bank Privat- und Geschäftskunden AG')).toBe(BankName.DEUTSCHE_BANK);
    expect(mentionedBank('The Discover card is issued by Discover Bank, Member FDIC.')).toBe(BankName.DISCOVER);
    expect(mentionedBank('Equitable Bank Tower. 30 Sample Avenue West')).toBe(BankName.EQ_BANK);
    expect(mentionedBank('www.fidelitybank.ng')).toBe(BankName.FIDELITY_BANK);
    expect(mentionedBank('Fifth Third Business Plus')).toBe(BankName.FIFTH_THIRD);
    expect(mentionedBank('Member FDIC. First Citizens Bank')).toBe(BankName.FIRST_CITIZENS);
    expect(mentionedBank('first direct is a division of HSBC UK Bank plc')).toBe(BankName.FIRST_DIRECT);
    expect(mentionedBank('visit fnb.co.za')).toBe(BankName.FNB);
    expect(mentionedBank('Found is a financial technology company, not a bank.')).toBe(BankName.FOUND);
    expect(mentionedBank('P.O. Box 16509 Fort Worth, Texas 76162 Member FDIC')).toBe(BankName.FROST);
    expect(mentionedBank('GO2bank, member FDIC')).toBe(BankName.GO2BANK);
    expect(mentionedBank('GoTyme Bank is regulated by the Bangko Sentral ng Pilipinas')).toBe(BankName.GOTYME);
    expect(mentionedBank('visit greatsouthernbank.com.au')).toBe(BankName.GREAT_SOUTHERN);
    expect(mentionedBank('©2013 - 2016 Green Dot Corporation')).toBe(BankName.GREEN_DOT);
    expect(mentionedBank('Halifax is a division of Bank of Scotland plc')).toBe(BankName.HALIFAX);
    expect(mentionedBank('Handelsbanken is the trading name of Handelsbanken plc')).toBe(BankName.HANDELSBANKEN);
    expect(mentionedBank('RTGS/NEFT IFSC : HDFC0001000')).toBe(BankName.HDFC);
    expect(mentionedBank('Heritage Bank Limited ABN 32 087 652 024')).toBe(BankName.HERITAGE);
    expect(mentionedBank('HSA Bank is a division of Webster Bank, N.A., Member FDIC')).toBe(BankName.HSA_BANK);
    expect(mentionedBank('visit www.hsbc.co.uk')).toBe(BankName.HSBC);
    expect(mentionedBank('The Huntington National Bank is Member FDIC.')).toBe(BankName.HUNTINGTON);
    expect(mentionedBank('Visit us Online: www.IBC.com')).toBe(BankName.IBC);
    expect(mentionedBank('Visit www.icicibank.com')).toBe(BankName.ICICI);
    expect(mentionedBank('© 2025 IFAST GLOBAL BANK LIMITED')).toBe(BankName.IFAST);
    expect(mentionedBank('ING Bank (Australia) Limited ABN 24 000 893 292')).toBe(BankName.ING);
    expect(mentionedBank('Wbsite: www.kbc.be')).toBe(BankName.KBC);
    expect(mentionedBank('KeyBank National Association P.O. Box 94825')).toBe(BankName.KEYBANK);
    expect(mentionedBank('Kroo Bank Ltd is authorised as a bank by the PRA')).toBe(BankName.KROO);
    expect(mentionedBank('Laurentian Bank of Canada')).toBe(BankName.LAURENTIAN);
    expect(mentionedBank('LLOYDS BASIC ACCT 18 May 2023 to 18 Aug 2023')).toBe(BankName.LLOYDS);
    expect(mentionedBank('Manufacturers and Traders Trust Company, member FDIC')).toBe(BankName.M_AND_T);
    expect(mentionedBank('Customer Service Information Marcus.com')).toBe(BankName.MARCUS);
    expect(mentionedBank('MERRICK ACCOUNT SUMMARY Account Number')).toBe(BankName.MERRICK);
    expect(mentionedBank('Metro Bank PLC is registered in England and Wales')).toBe(BankName.METRO_BANK);
    expect(mentionedBank('Monzo Bank Limited (https://monzo.com) is a company registered in England')).toBe(BankName.MONZO);
    expect(mentionedBank('Your N26 Team')).toBe(BankName.N26);
    expect(mentionedBank('NAB iSaver For further information call 13 22 65')).toBe(BankName.NAB);
    expect(mentionedBank('Online nationwide.co.uk Phone 0800 30 20 11')).toBe(BankName.NATIONWIDE);
    expect(mentionedBank('Manage your statements online at www.natwest.com')).toBe(BankName.NATWEST);
    expect(mentionedBank('Visit navyfederal.org for more information')).toBe(BankName.NAVY_FEDERAL);
    expect(mentionedBank('NCBA Bank Kenya PLC')).toBe(BankName.NCBA);
    expect(mentionedBank('WebSite: www.netspend.com')).toBe(BankName.NETSPEND);
    expect(mentionedBank('Online: optumbank.com')).toBe(BankName.OPTUM);
    expect(mentionedBank('© 2005-2024 Payoneer, All Rights Reserved')).toBe(BankName.PAYONEER);
    expect(mentionedBank('PayPal Savings Statement Statement Period')).toBe(BankName.PAYPAL);
    expect(mentionedBank('For customer service call 1-888-PNC-BANK')).toBe(BankName.PNC);
    expect(mentionedBank('MEMBER FDIC NYSE Symbol "PB"')).toBe(BankName.PROSPERITY);
    expect(mentionedBank('Qatar National Bank (Q.P.S.C.)')).toBe(BankName.QNB);
    expect(mentionedBank('Cod BIC Raiffeisen Bank: RZBRROBU')).toBe(BankName.RAIFFEISEN);
    expect(mentionedBank('Your RBC personal banking account statement')).toBe(BankName.RBC);
    expect(mentionedBank('please call 1-800-REGIONS (734-4667)')).toBe(BankName.REGIONS);
    expect(mentionedBank('Revolut Ltd (No. 08804411) is authorised by the FCA')).toBe(BankName.REVOLUT);
    expect(mentionedBank('Royal Bank of Scotland Plc. Registered Office, The Mound')).toBe(BankName.RBS);
    expect(mentionedBank('interac e-transfer to cibc client')).toBeUndefined();
    expect(mentionedBank('transfer from chime savings account')).toBeUndefined();
    expect(mentionedBank('Example Bank, Main Street')).toBeUndefined();
    expect(statement(usual, 'ACME', '12.50')?.mentionedBank).toBeUndefined();
    expect(
      layoutOf([usual], 'Axis Bank Ltd statement')?.mentionedBank,
    ).toBe(BankName.AXIS);
  });
});
