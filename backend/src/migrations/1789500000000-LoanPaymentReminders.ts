import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reminders for loan payments, through the repeating bills that already remind.
 *
 * `loan_terms.remind_days_before`: how many days before each payment date the
 * reminder goes out; null is no reminders (every loan saved before this).
 * While it is set the loan keeps one bill series in step with its schedule.
 *
 * `payables.loan_wallet_id`: the loan account a bill is a payment of. The
 * loan's terms own its rule and amounts; paying it from an account moves the
 * money into the loan account, and a payment that reaches the loan account
 * settles it. A deleted loan account leaves its paid bills as plain bills
 * (SET NULL); the application ends the series and removes the open ones first.
 */
export class LoanPaymentReminders1789500000000 implements MigrationInterface {
  name = 'LoanPaymentReminders1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_terms" ADD COLUMN IF NOT EXISTS "remind_days_before" smallint NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_terms" DROP CONSTRAINT IF EXISTS "CHK_loan_terms_remind_days"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_terms" ADD CONSTRAINT "CHK_loan_terms_remind_days"
         CHECK ("remind_days_before" IS NULL OR "remind_days_before" BETWEEN 0 AND 30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" ADD COLUMN IF NOT EXISTS "loan_wallet_id" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" DROP CONSTRAINT IF EXISTS "FK_payables_loan_wallet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" ADD CONSTRAINT "FK_payables_loan_wallet"
         FOREIGN KEY ("loan_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payables_loan_wallet"
         ON "payables" ("workspace_id", "loan_wallet_id") WHERE "loan_wallet_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payables_loan_wallet"`);
    await queryRunner.query(
      `ALTER TABLE "payables" DROP CONSTRAINT IF EXISTS "FK_payables_loan_wallet"`,
    );
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN IF EXISTS "loan_wallet_id"`);
    await queryRunner.query(
      `ALTER TABLE "loan_terms" DROP CONSTRAINT IF EXISTS "CHK_loan_terms_remind_days"`,
    );
    await queryRunner.query(`ALTER TABLE "loan_terms" DROP COLUMN IF EXISTS "remind_days_before"`);
  }
}
