import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('ReleaseTransferPartnerOnDelete migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788155000000-ReleaseTransferPartnerOnDelete.ts',
  );

  const source = () => readFileSync(filePath, 'utf8');
  const up = () =>
    source().slice(source().indexOf('public async up'), source().indexOf('public async down'));

  it('releases the other legs of the deleted row in its own workspace only', () => {
    expect(existsSync(filePath)).toBe(true);
    const text = up();
    expect(text).toContain('CREATE OR REPLACE FUNCTION "release_transfer_partner"()');
    expect(text).toMatch(
      /SET "transfer_pair_id" = NULL, "transfer_pair_source" = NULL, "transfer_pair_kind" = NULL/,
    );
    expect(text).toContain('"workspace_id" = OLD."workspace_id"');
    expect(text).toContain('"transfer_pair_id" = OLD."transfer_pair_id"');
    expect(text).toContain('"id" <> OLD."id"');
  });

  it('runs after each deleted row that had a pair, and can run twice', () => {
    const text = up();
    expect(text).toContain(
      'DROP TRIGGER IF EXISTS "TRG_transactions_release_transfer_partner" ON "transactions"',
    );
    expect(text).toMatch(/AFTER DELETE ON "transactions"\s+FOR EACH ROW WHEN \(OLD\."transfer_pair_id" IS NOT NULL\)/);
  });

  it('leaves pairs already broken by earlier deletes alone', () => {
    expect(up()).not.toMatch(/UPDATE "transactions"[\s\S]*WHERE NOT EXISTS/);
    expect(up().match(/UPDATE "transactions"/g)).toHaveLength(1);
  });

  it('reverses itself', () => {
    const down = source().slice(source().indexOf('public async down'));
    expect(down).toContain('DROP TRIGGER IF EXISTS "TRG_transactions_release_transfer_partner"');
    expect(down).toContain('DROP FUNCTION IF EXISTS "release_transfer_partner"()');
  });
});
