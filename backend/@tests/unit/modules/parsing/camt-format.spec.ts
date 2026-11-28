import { parseCamt053, sniffStatementFormat } from '@/modules/parsing/parsers/statement-formats.util';

const IBAN = 'DE89370400440532013000';
const PAYEE_IBAN = 'NL91ABNA0417164300';
const PAYEE_BIC = 'ABNANL2A';

const document = (wrapper: string, body: string, schema = 'camt.053.001.02') => `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:${schema}">
<${wrapper}>${body}</${wrapper}>
</Document>`;

const entry = (amount: string, side: 'DBIT' | 'CRDT', details: string, ref = 'ENTRY-1') =>
  `<Ntry><Amt Ccy="EUR">${amount}</Amt><CdtDbtInd>${side}</CdtDbtInd>
<BookgDt><Dt>2026-09-10</Dt></BookgDt><AcctSvcrRef>${ref}</AcctSvcrRef>
<NtryDtls>${details}</NtryDtls></Ntry>`;

const payment = (opts: { amount?: string; name: string; purpose: string; ref?: string }) =>
  `<TxDtls>${opts.ref ? `<Refs><EndToEndId>${opts.ref}</EndToEndId></Refs>` : ''}
${opts.amount ? `<Amt Ccy="EUR">${opts.amount}</Amt>` : ''}
<RltdPties><Cdtr><Nm>${opts.name}</Nm></Cdtr></RltdPties>
<RmtInf><Ustrd>${opts.purpose}</Ustrd></RmtInf></TxDtls>`;

const ACCOUNT = `<Acct><Id><IBAN>${IBAN}</IBAN></Id><Ccy>EUR</Ccy></Acct>`;
const statement = (body: string) => document('BkToCstmrStmt', `<Stmt>${ACCOUNT}${body}</Stmt>`);

describe('camt entries', () => {
  it('splits a batch entry into one row per payment', () => {
    const rent = { amount: '700.00', name: 'Member One', purpose: 'Rent', ref: 'E2E-RENT' };
    const club = { amount: '50.00', name: 'Member Two', purpose: 'Club fee', ref: 'E2E-CLUB' };
    const parsed = parseCamt053(statement(entry('750.00', 'DBIT', payment(rent) + payment(club))));

    expect(parsed.transactions).toMatchObject([
      { debit: 700, counterpartyName: rent.name, paymentPurpose: rent.purpose, documentNumber: rent.ref },
      { debit: 50, counterpartyName: club.name, paymentPurpose: club.purpose, documentNumber: club.ref },
    ]);
  });

  it('numbers the entry reference when the payments carry none, so dedupe keeps them apart', () => {
    const body = entry(
      '30.00',
      'DBIT',
      payment({ amount: '10.00', name: 'ACME Store', purpose: 'Buds' }) +
        payment({ amount: '20.00', name: 'ACME Store', purpose: 'Cable', ref: 'NOTPROVIDED' }),
      'BATCH-7',
    );
    const refs = parseCamt053(statement(body)).transactions.map(t => t.documentNumber);
    expect(refs).toEqual(['BATCH-7/1', 'BATCH-7/2']);
  });

  it('keeps one row when the payments do not add up to the entry', () => {
    const body = entry(
      '100.00',
      'DBIT',
      payment({ amount: '10.00', name: 'Member One', purpose: 'A' }) +
        payment({ amount: '20.00', name: 'Member Two', purpose: 'B' }),
    );
    expect(parseCamt053(statement(body)).transactions).toMatchObject([{ debit: 100 }]);
  });

  it('keeps one row when a payment states no amount', () => {
    const body = entry(
      '30.00',
      'DBIT',
      payment({ amount: '10.00', name: 'Member One', purpose: 'A' }) +
        payment({ name: 'Member Two', purpose: 'B' }),
    );
    expect(parseCamt053(statement(body)).transactions).toHaveLength(1);
  });

  it('reads a payment amount from the instructed transaction amount', () => {
    const detail = (amount: string, name: string) =>
      `<TxDtls><AmtDtls><TxAmt><Amt Ccy="EUR">${amount}</Amt></TxAmt></AmtDtls>
<RltdPties><Dbtr><Nm>${name}</Nm></Dbtr></RltdPties></TxDtls>`;
    const body = entry('15.00', 'CRDT', detail('5.00', 'Member One') + detail('10.00', 'Member Two'));
    expect(parseCamt053(statement(body)).transactions).toMatchObject([
      { credit: 5, counterpartyName: 'Member One' },
      { credit: 10, counterpartyName: 'Member Two' },
    ]);
  });

  it('does not take a charge for the payment amount', () => {
    const detail = (amount: string, name: string) =>
      `<TxDtls><AmtDtls><TxAmt><Amt Ccy="EUR">${amount}</Amt></TxAmt></AmtDtls>
<Chrgs><Rcrd><Amt Ccy="EUR">0.50</Amt></Rcrd></Chrgs>
<RltdPties><Cdtr><Nm>${name}</Nm></Cdtr></RltdPties></TxDtls>`;
    const body = entry('30.00', 'DBIT', detail('10.00', 'Member One') + detail('20.00', 'Member Two'));
    expect(parseCamt053(statement(body)).transactions).toMatchObject([
      { debit: 10, counterpartyName: 'Member One' },
      { debit: 20, counterpartyName: 'Member Two' },
    ]);
  });

  it('keeps one row when a payment states no amount, even if the others add up', () => {
    const body = entry(
      '30.00',
      'DBIT',
      payment({ amount: '30.00', name: 'Member One', purpose: 'A' }) +
        payment({ name: 'Member Two', purpose: 'B' }),
    );
    expect(parseCamt053(statement(body)).transactions).toMatchObject([{ debit: 30 }]);
  });

  it('keeps one row when the payments are in another currency', () => {
    const detail = (amount: string) =>
      `<TxDtls><Amt Ccy="USD">${amount}</Amt><RltdPties><Cdtr><Nm>Member One</Nm></Cdtr></RltdPties></TxDtls>`;
    const body = entry('30.00', 'DBIT', detail('10.00') + detail('20.00'));
    expect(parseCamt053(statement(body)).transactions).toMatchObject([{ debit: 30, currency: 'EUR' }]);
  });

  it('gives a batch kept whole no one payment\'s account', () => {
    const detail = (amount: string) =>
      `<TxDtls><Amt Ccy="EUR">${amount}</Amt><RltdPties><Cdtr><Nm>Member One</Nm></Cdtr>
<CdtrAcct><Id><IBAN>${PAYEE_IBAN}</IBAN></Id></CdtrAcct></RltdPties></TxDtls>`;
    const [row] = parseCamt053(statement(entry('99.00', 'DBIT', detail('1.00') + detail('2.00'))))
      .transactions;
    expect(row.counterpartyAccount).toBeUndefined();
  });

  it('numbers payments whose own references repeat or equal the entry one', () => {
    const body = entry(
      '30.00',
      'DBIT',
      payment({ amount: '10.00', name: 'Member One', purpose: 'A', ref: 'SAME' }) +
        payment({ amount: '15.00', name: 'Member Two', purpose: 'B', ref: 'SAME' }) +
        payment({ amount: '5.00', name: 'Member Three', purpose: 'C', ref: 'BATCH-9' }),
      'BATCH-9',
    );
    const refs = parseCamt053(statement(body)).transactions.map(t => t.documentNumber);
    expect(refs).toEqual(['SAME', 'BATCH-9/2', 'BATCH-9/3']);
  });

  it('names the party behind an intermediary and reads its account and bank', () => {
    const detail = `<TxDtls><RltdPties>
<Cdtr><Nm>ACME Payments</Nm></Cdtr><CdtrAcct><Id><IBAN>${PAYEE_IBAN}</IBAN></Id></CdtrAcct>
<UltmtCdtr><Nm>ACME Store</Nm></UltmtCdtr></RltdPties>
<RltdAgts><CdtrAgt><FinInstnId><BIC>${PAYEE_BIC}</BIC></FinInstnId></CdtrAgt></RltdAgts>
<RmtInf><Ustrd>Wireless Buds</Ustrd></RmtInf></TxDtls>`;
    expect(parseCamt053(statement(entry('42.00', 'DBIT', detail))).transactions[0]).toMatchObject({
      counterpartyName: 'ACME Store',
      counterpartyAccount: PAYEE_IBAN,
      counterpartyBank: PAYEE_BIC,
    });
  });

  it('does not take NOTPROVIDED for a reference', () => {
    const body = `<Ntry><Amt Ccy="EUR">5.00</Amt><CdtDbtInd>DBIT</CdtDbtInd>
<BookgDt><Dt>2026-09-10</Dt></BookgDt><NtryDtls>${payment({ name: 'ACME Store', purpose: 'Buds', ref: 'NOTPROVIDED' })}</NtryDtls></Ntry>`;
    expect(parseCamt053(statement(body)).transactions[0].documentNumber).toBeUndefined();
  });

  it('falls back to the structured creditor reference for the purpose', () => {
    const detail = `<TxDtls><RltdPties><Cdtr><Nm>ACME Utilities</Nm></Cdtr></RltdPties>
<RmtInf><Strd><CdtrRefInf><Ref>RF18539007547034</Ref></CdtrRefInf></Strd></RmtInf></TxDtls>`;
    expect(parseCamt053(statement(entry('60.00', 'DBIT', detail))).transactions[0].paymentPurpose).toBe(
      'RF18539007547034',
    );
  });

  it('recognises and reads a camt.054 notification', () => {
    const text = document(
      'BkToCstmrDbtCdtNtfctn',
      `<Ntfctn>${ACCOUNT}${entry(
        '12.00',
        'CRDT',
        '<TxDtls><RltdPties><Dbtr><Nm>Member One</Nm></Dbtr></RltdPties></TxDtls>',
      )}</Ntfctn>`,
      'camt.054.001.08',
    );

    expect(sniffStatementFormat(text)).toBe('camt');
    const parsed = parseCamt053(text);
    expect(parsed.metadata.accountNumber).toBe(IBAN);
    expect(parsed.transactions).toMatchObject([{ credit: 12, counterpartyName: 'Member One' }]);
  });
});
