import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('LoanPaymentSplit migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788240000000-LoanPaymentSplit.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');

  it('adds the link and the setting only when they are missing', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(source()).toContain('ADD COLUMN IF NOT EXISTS "loan_interest_of_id" uuid');
    expect(source()).toContain('ADD COLUMN IF NOT EXISTS "auto_split" boolean NOT NULL DEFAULT false');
    expect(source()).toContain("WHERE conname = 'FK_transactions_loan_interest_of'");
  });

  it('keeps one interest row per payment, gone with the payment', () => {
    expect(source()).toMatch(
      /FOREIGN KEY \("loan_interest_of_id"\) REFERENCES "transactions"\("id"\) ON DELETE CASCADE/,
    );
    expect(source()).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transactions_loan_interest_of"[\s\S]*WHERE "loan_interest_of_id" IS NOT NULL AND "split_group_id" IS NULL/,
    );
    // The parts of split interest all keep the link: found, and removed with the payment, by it.
    expect(source()).toMatch(/CREATE INDEX IF NOT EXISTS "IDX_transactions_loan_interest_of"/);
  });

  it('lets the interest row follow its payment into and out of the counted rows', () => {
    expect(source()).toMatch(
      /AFTER UPDATE OF "is_verified", "is_duplicate", "wallet_id", "transaction_type", "amount", "debit", "credit"\s+ON "transactions"/,
    );
    // Fires on payments, not on the interest rows it updates.
    expect(source()).toContain('OLD."loan_interest_of_id" IS NULL');
    expect(source()).toMatch(/SET "is_verified" = NEW\."is_verified", "is_duplicate" = NEW\."is_duplicate"/);
    // Only the payment's own interest, in its own workspace.
    expect(source()).toContain('"loan_interest_of_id" = NEW."id"');
    expect(source()).toContain('"workspace_id" = NEW."workspace_id"');
  });

  it('joins the split back once the row is no longer a payment into that loan', () => {
    expect(source()).toContain('NEW."wallet_id" IS DISTINCT FROM OLD."wallet_id"');
    expect(source()).toContain(`NEW."transaction_type" <> 'income'`);
    expect(source()).toContain('COALESCE(NEW."amount", NEW."credit", NEW."debit", 0) < interest');
  });

  it('takes everything back on the way down', () => {
    expect(source()).toContain('DROP TRIGGER IF EXISTS "TRG_transactions_loan_interest_follow"');
    expect(source()).toContain('DROP FUNCTION IF EXISTS "loan_interest_follow_payment"()');
    expect(source()).toContain('DROP COLUMN IF EXISTS "auto_split"');
    expect(source()).toContain('DROP COLUMN IF EXISTS "loan_interest_of_id"');
    expect(source()).toContain('DROP INDEX IF EXISTS "IDX_transactions_loan_interest_of"');
  });
});
