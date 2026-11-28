import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import {
  brokerStatementTable,
  rejectBrokerReports,
} from '@/modules/entity-imports/broker/broker-statement';

const FIXTURE = path.join(__dirname, '../../fixtures/parsing/revolut-trading-made-up.pdf');
const BANK = path.join(__dirname, '../../../golden/revolut/sample2.pdf');

/** A copy the check may delete, as multer leaves uploads on disk. */
function upload(source: string, name: string): Express.Multer.File {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'broker-spec-'));
  const file = path.join(dir, name);
  fs.copyFileSync(source, file);
  return { path: file, originalname: name, mimetype: 'application/pdf' } as Express.Multer.File;
}

describe('broker reports', () => {
  it('refuses a broker statement uploaded as a bank statement', async () => {
    const file = upload(FIXTURE, 'revolut.pdf');
    const refusal = await rejectBrokerReports([file]).catch(error => error);
    expect(refusal).toBeInstanceOf(BadRequestException);
    expect(refusal.getResponse()).toMatchObject({ code: 'STATEMENT_IS_BROKER_REPORT' });
  });

  it("lets a bank's statement through, Revolut's included", async () => {
    const file = upload(BANK, 'revolut-bank.pdf');
    await expect(rejectBrokerReports([file])).resolves.toBeUndefined();
    expect(fs.existsSync(file.path)).toBe(true);
  });

  it("reads a broker's PDF into the wizard's table, and refuses another PDF", async () => {
    const table = await brokerStatementTable(new Uint8Array(fs.readFileSync(FIXTURE)));
    expect(table.source).toBe('revolut_trading');
    expect(table.rows.length).toBe(12);
    const refusal = await brokerStatementTable(new Uint8Array(fs.readFileSync(BANK))).catch(error => error);
    expect(refusal.getResponse()).toMatchObject({ code: 'BROKER_STATEMENT_UNREADABLE' });
  });
});
