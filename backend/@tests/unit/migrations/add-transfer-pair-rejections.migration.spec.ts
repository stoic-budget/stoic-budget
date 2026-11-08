import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddTransferPairRejections migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788150000000-AddTransferPairRejections.ts',
  );

  const source = () => readFileSync(filePath, 'utf8');
  const up = () => source().slice(source().indexOf('public async up'), source().indexOf('public async down'));

  it('creates the table once, keyed by the ordered pair', () => {
    expect(existsSync(filePath)).toBe(true);
    const text = up();
    expect(text).toContain('CREATE TABLE IF NOT EXISTS "transfer_pair_rejections"');
    expect(text).toContain('UNIQUE ("tx_low_id", "tx_high_id")');
    // A restore gives rows new ids and may flip the order: no CHECK on it.
    expect(text).not.toContain('CHECK (');
    expect(text).toContain('CREATE INDEX IF NOT EXISTS "IDX_transfer_pair_rejections_workspace"');
  });

  it('goes away with either row or the workspace', () => {
    const text = up();
    expect(text).toMatch(/FOREIGN KEY \("workspace_id"\)\s+REFERENCES "workspaces"\("id"\) ON DELETE CASCADE/);
    for (const column of ['tx_low_id', 'tx_high_id']) {
      expect(text).toMatch(
        new RegExp(`FOREIGN KEY \\("${column}"\\)\\s+REFERENCES "transactions"\\("id"\\) ON DELETE CASCADE`),
      );
    }
  });

  it('leaves rows already marked rejected alone', () => {
    expect(source()).not.toContain('UPDATE "transactions"');
  });

  it('reverses itself', () => {
    const down = source().slice(source().indexOf('public async down'));
    expect(down).toContain('DROP TABLE IF EXISTS "transfer_pair_rejections"');
  });
});
