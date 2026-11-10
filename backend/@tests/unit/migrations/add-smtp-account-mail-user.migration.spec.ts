import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddSmtpAccountMailUser migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1788440000000-AddSmtpAccountMailUser.ts'),
    'utf8',
  );

  it('adds the grant as a nullable user reference that a deleted user clears', () => {
    expect(source).toContain('ADD COLUMN IF NOT EXISTS "account_mail_user_id" uuid');
    expect(source).toContain(
      'FOREIGN KEY ("account_mail_user_id") REFERENCES "users"("id") ON DELETE SET NULL',
    );
  });

  // A restored row names the restorer as its saver without any password check:
  // copying updated_by_user_id would grant exactly the rows the fix is about.
  it('grants no existing row', () => {
    expect(source).not.toMatch(/UPDATE\s+"?workspace_service_settings/i);
  });

  it('drops the constraint and the column on the way down', () => {
    expect(source).toContain(
      'DROP CONSTRAINT IF EXISTS "FK_workspace_service_settings_account_mail_user"',
    );
    expect(source).toContain('DROP COLUMN IF EXISTS "account_mail_user_id"');
  });
});
