import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AddBankSyncSchedule1788360000000 } from '../../../src/migrations/1788360000000-AddBankSyncSchedule';

describe('AddBankSyncSchedule migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1788360000000-AddBankSyncSchedule.ts'),
    'utf8',
  );

  const run = async (direction: 'up' | 'down'): Promise<string[]> => {
    const queries: string[] = [];
    const runner = { query: vi.fn(async (sql: string) => void queries.push(sql)) };
    await new AddBankSyncSchedule1788360000000()[direction](runner as never);
    return queries.map(sql => sql.replace(/\s+/g, ' '));
  };

  it('adds every schedule column idempotently, keeping six hours as the default cadence', async () => {
    const sql = (await run('up')).join('\n');
    for (const column of [
      '"sync_interval_hours" smallint NOT NULL DEFAULT 6',
      '"next_pull_at" timestamptz',
      '"pull_lease_until" timestamptz',
      '"last_pull_attempt_at" timestamptz',
      '"consecutive_failures" integer NOT NULL DEFAULT 0',
      '"backoff_until" timestamptz',
      '"backoff_reason" varchar(500)',
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(sql).toContain('CHECK ("sync_interval_hours" BETWEEN 1 AND 24)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "IDX_open_protocol_settings_next_pull_at"');
  });

  it('spreads the first due time of existing bank connections over six hours instead of now', async () => {
    const backfill = (await run('up')).find(sql => sql.includes('UPDATE'));
    expect(backfill).toContain(`now() + random() * interval '6 hours'`);
    expect(backfill).toContain(`i."provider" IN ('simplefin', 'enablebanking')`);
    expect(backfill).toContain('s."next_pull_at" IS NULL');
  });

  it('drops what it added on the way down', async () => {
    const sql = (await run('down')).join('\n');
    expect(sql).toContain('DROP INDEX IF EXISTS "IDX_open_protocol_settings_next_pull_at"');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS "CHK_open_protocol_settings_sync_interval"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "sync_interval_hours"');
    expect(source).toContain('DROP COLUMN IF EXISTS "backoff_reason"');
  });
});
