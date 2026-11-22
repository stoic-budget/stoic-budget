import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Behaviour is proven against Postgres in @tests/e2e/calendar-feed.e2e-spec.ts;
// this pins the text so an edit that weakens a guarantee shows up in review.
describe('AddCalendarFeeds migration', () => {
  const filePath = path.join(process.cwd(), 'src', 'migrations', '1788220000000-AddCalendarFeeds.ts');
  const source = () => readFileSync(filePath, 'utf8');
  const up = () =>
    source().slice(source().indexOf('public async up'), source().indexOf('public async down'));
  const down = () => source().slice(source().indexOf('public async down'));

  it('creates the table idempotently, with every kind switched on by default', () => {
    expect(existsSync(filePath)).toBe(true);
    const text = up();
    expect(text).toContain('CREATE TABLE IF NOT EXISTS "calendar_feeds"');
    for (const column of ['payables', 'subscriptions', 'tax_deadlines', 'invoices']) {
      expect(text).toContain(`"include_${column}" boolean NOT NULL DEFAULT true`);
    }
  });

  it('keeps only a 64-character hash of the token, unique across workspaces', () => {
    const text = up();
    expect(text).toContain('"token_hash" character varying(64) NOT NULL');
    expect(text).not.toMatch(/"token" /);
    expect(text).toContain('ON "calendar_feeds" ("token_hash")');
  });

  it('has one feed per member and workspace, removed with either', () => {
    const text = up();
    expect(text).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_calendar_feeds_member"');
    expect(text).toContain('("workspace_id", "member_id")');
    expect(text).toContain('REFERENCES "workspaces"("id") ON DELETE CASCADE');
    expect(text).toContain('REFERENCES "workspace_members"("id") ON DELETE CASCADE');
  });

  it('drops the table on the way down', () => {
    expect(down()).toContain('DROP TABLE IF EXISTS "calendar_feeds"');
  });
});
