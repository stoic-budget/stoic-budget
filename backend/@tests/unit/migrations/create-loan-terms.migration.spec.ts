import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('CreateLoanTerms migration', () => {
  const filePath = path.join(process.cwd(), 'src', 'migrations', '1788230000000-CreateLoanTerms.ts');
  const source = () => readFileSync(filePath, 'utf8');

  it('creates the table only when it is missing', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(source()).toContain('CREATE TABLE IF NOT EXISTS loan_terms');
    expect(source()).toContain('CREATE INDEX IF NOT EXISTS "IDX_loan_terms_workspace"');
  });

  it('goes with its workspace and its account, one row per account', () => {
    expect(source()).toMatch(/FOREIGN KEY \(workspace_id\)\s+REFERENCES "workspaces"\("id"\) ON DELETE CASCADE/);
    expect(source()).toMatch(/FOREIGN KEY \(wallet_id\)\s+REFERENCES "wallets"\("id"\) ON DELETE CASCADE/);
    expect(source()).toContain('UNIQUE (wallet_id)');
  });

  it('refuses terms the schedule cannot work with', () => {
    expect(source()).toContain('CHECK (principal > 0)');
    expect(source()).toContain('CHECK (term_months BETWEEN 1 AND 600)');
    expect(source()).toContain('CHECK (payment_day BETWEEN 1 AND 31)');
  });

  it('drops the table on the way down', () => {
    expect(source()).toContain('DROP TABLE IF EXISTS loan_terms');
  });
});
