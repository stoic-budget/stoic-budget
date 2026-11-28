import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Mt940Parser } from '@/modules/parsing/parsers/mt940.parser';
import { OfxParser } from '@/modules/parsing/parsers/ofx.parser';

/** OFX and MT940 exports are often Windows-1252: read as such, not as UTF-8 (#637). */
describe('OFX and MT940 in Windows-1252', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-statement-encoding-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Latin-1 bytes, the same as Windows-1252 for these letters. */
  const write = (name: string, text: string) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, Buffer.from(text, 'latin1'));
    return filePath;
  };

  it('reads an OFX payee with accents', async () => {
    const filePath = write(
      'export.ofx',
      `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>EUR
<BANKACCTFROM><BANKID>123<ACCTID>987654321<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903<TRNAMT>-42.50<FITID>T1<NAME>CAFÉ MÜLLER</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
    );

    const result = await new OfxParser().parse(filePath);

    expect(result.transactions[0].counterpartyName).toContain('CAFÉ MÜLLER');
  });

  it('reads an MT940 purpose with umlauts', async () => {
    const filePath = write(
      'export.sta',
      `:20:STARTUMS
:25:12345678/987654321
:28C:1/1
:60F:C260901EUR100,00
:61:2609030903DR42,50NMSCNONREF//REF1
:86:166?00SEPA-LASTSCHRIFT?20Brötchen?32Bäckerei Müller
:62F:C260930EUR57,50
-`,
    );

    const result = await new Mt940Parser().parse(filePath);
    const row = result.transactions[0];

    expect(`${row.counterpartyName} ${row.paymentPurpose}`).toContain('Müller');
  });
});
