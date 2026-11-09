import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A loan payment split into principal and interest.
 *
 * The payment row (the incoming leg on the loan account, paired with the
 * checking leg or alone) is never changed. The interest becomes a row of its
 * own: an expense on the loan account, as the bank charges it, pointing at the
 * payment through `loan_interest_of_id`. The loan's debt then falls by the
 * principal only, the checking account still shows the whole payment, and the
 * interest counts as spending once. One interest row per payment (a generic
 * split of it gives parts that all keep the link); it goes when the payment
 * goes.
 *
 * The interest counts only while its payment counts (counted-transactions.util
 * checks the payment). A trigger keeps it in step besides:
 * - it copies the payment's `is_verified` and `is_duplicate`, so Review shows
 *   the interest confirmed with its payment;
 * - it joins the split back (deletes the interest) once the row is no longer a
 *   payment into that loan: moved to another account, turned into an expense,
 *   or its amount cut below the interest.
 *
 * `loan_terms.auto_split`: split new payments into the account on import.
 */
export class LoanPaymentSplit1788240000000 implements MigrationInterface {
  name = 'LoanPaymentSplit1788240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "loan_interest_of_id" uuid',
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_transactions_loan_interest_of') THEN
          ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_loan_interest_of"
            FOREIGN KEY ("loan_interest_of_id") REFERENCES "transactions"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);
    // One interest row per payment; the parts of a split one share a group.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transactions_loan_interest_of"
        ON "transactions" ("loan_interest_of_id")
        WHERE "loan_interest_of_id" IS NOT NULL AND "split_group_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_loan_interest_of"
        ON "transactions" ("loan_interest_of_id")
        WHERE "loan_interest_of_id" IS NOT NULL
    `);
    await queryRunner.query(
      'ALTER TABLE "loan_terms" ADD COLUMN IF NOT EXISTS "auto_split" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "loan_interest_follow_payment"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        interest numeric;
      BEGIN
        SELECT SUM(COALESCE("amount", "debit", "credit", 0)) INTO interest
          FROM "transactions"
         WHERE "loan_interest_of_id" = NEW."id" AND "workspace_id" = NEW."workspace_id";
        IF interest IS NULL THEN
          RETURN NULL;
        END IF;
        IF NEW."wallet_id" IS DISTINCT FROM OLD."wallet_id"
           OR NEW."transaction_type" <> 'income'
           OR COALESCE(NEW."amount", NEW."credit", NEW."debit", 0) < interest THEN
          DELETE FROM "transactions"
           WHERE "loan_interest_of_id" = NEW."id" AND "workspace_id" = NEW."workspace_id";
          RETURN NULL;
        END IF;
        UPDATE "transactions"
           SET "is_verified" = NEW."is_verified", "is_duplicate" = NEW."is_duplicate"
         WHERE "loan_interest_of_id" = NEW."id"
           AND "workspace_id" = NEW."workspace_id"
           AND ("is_verified", "is_duplicate") IS DISTINCT FROM (NEW."is_verified", NEW."is_duplicate");
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_transactions_loan_interest_follow" ON "transactions"',
    );
    // Fires on payments only: an interest row has the link, a payment does not.
    await queryRunner.query(`
      CREATE TRIGGER "TRG_transactions_loan_interest_follow"
        AFTER UPDATE OF "is_verified", "is_duplicate", "wallet_id", "transaction_type", "amount", "debit", "credit"
        ON "transactions"
        FOR EACH ROW
        WHEN (
          OLD."loan_interest_of_id" IS NULL
          AND (OLD."is_verified", OLD."is_duplicate", OLD."wallet_id", OLD."transaction_type", OLD."amount", OLD."debit", OLD."credit")
            IS DISTINCT FROM
              (NEW."is_verified", NEW."is_duplicate", NEW."wallet_id", NEW."transaction_type", NEW."amount", NEW."debit", NEW."credit")
        )
        EXECUTE FUNCTION "loan_interest_follow_payment"()
    `);
  }

  /**
   * The schema goes; the interest rows stay, as plain expenses: deleting them
   * would change balances and spending on a rollback. They can no longer be
   * joined back from the loan page.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_transactions_loan_interest_follow" ON "transactions"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS "loan_interest_follow_payment"()');
    await queryRunner.query('ALTER TABLE "loan_terms" DROP COLUMN IF EXISTS "auto_split"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_transactions_loan_interest_of"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_transactions_loan_interest_of"');
    await queryRunner.query(
      'ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_loan_interest_of"',
    );
    await queryRunner.query(
      'ALTER TABLE "transactions" DROP COLUMN IF EXISTS "loan_interest_of_id"',
    );
  }
}
