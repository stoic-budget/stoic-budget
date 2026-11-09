import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Behaviour is proven against Postgres in @tests/e2e/payable-recurrence.e2e-spec.ts;
// this pins the text so an edit that weakens a guarantee shows up in review.
describe('AddPayableRecurrence migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788210000000-AddPayableRecurrence.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');
  const up = () =>
    source().slice(source().indexOf('public async up'), source().indexOf('public async down'));
  const down = () => source().slice(source().indexOf('public async down'));

  it('adds the recurrence columns, with a bounded reminder lead defaulting to 3 days', () => {
    expect(existsSync(filePath)).toBe(true);
    const text = up();
    for (const column of [
      '"recurrence" jsonb',
      '"remind_days_before" integer NOT NULL DEFAULT 3',
      '"series_id" uuid',
      '"occurrence_date" date',
      '"base_amount" numeric(15,2)',
      '"skipped_at" timestamptz',
    ]) {
      expect(text).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(text).toContain('CHECK ("remind_days_before" BETWEEN 0 AND 60)');
  });

  it('makes one occurrence per series and day per workspace, deleted ones included', () => {
    const index = up().match(/CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payables_series_occurrence"[^`]*/)?.[0];
    expect(index).toContain('("workspace_id", "series_id", "occurrence_date")');
    expect(index).toContain('WHERE "series_id" IS NOT NULL');
    // A deleted occurrence keeps its day, so the series never makes it again.
    expect(index).not.toContain('deleted_at');
  });

  it('turns old recurring flags into a monthly rule for the newest current bill of a vendor only', () => {
    const text = up();
    expect(text).toContain('SELECT DISTINCT ON ("workspace_id", "direction", lower("vendor"), "currency")');
    expect(text).toContain('"due_date" DESC');
    expect(text).toContain("'frequency', 'monthly'");
    expect(text).toContain('"series_id" = p."id"');
    expect(text).toContain('"occurrence_date" = p."due_date"');
    // The cut-off holds for open bills too: an old overdue one would come back as a run.
    expect(text).toContain('AND p."due_date" >= current_date - 45');
    expect(text).not.toContain(`p."status" NOT IN`);
  });

  it('creates both rejection tables with a unique pair and cascading keys', () => {
    const text = up();
    expect(text).toContain("['payable_match_rejections', 'payable_id', 'payables']");
    expect(text).toContain("['subscription_match_rejections', 'subscription_id', 'subscriptions']");
    expect(text).toContain('REFERENCES "workspaces"("id") ON DELETE CASCADE');
    expect(text).toContain('REFERENCES "transactions"("id") ON DELETE CASCADE');
    expect(text).toContain('REFERENCES "users"("id") ON DELETE SET NULL');
    expect(text).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_${table}_pair"');
  });

  it('adds the fortnightly and half-yearly subscription frequencies', () => {
    const text = up();
    expect(text).toContain(`ADD VALUE IF NOT EXISTS 'biweekly'`);
    expect(text).toContain(`ADD VALUE IF NOT EXISTS 'semiannual'`);
  });

  it('drops what it added on the way down', () => {
    const text = down();
    expect(text).toContain('DROP TABLE IF EXISTS "subscription_match_rejections"');
    expect(text).toContain('DROP TABLE IF EXISTS "payable_match_rejections"');
    expect(text).toContain('DROP INDEX IF EXISTS "UQ_payables_series_occurrence"');
    expect(text).toContain('DROP COLUMN IF EXISTS "recurrence"');
  });
});
