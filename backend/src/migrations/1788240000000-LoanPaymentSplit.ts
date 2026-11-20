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
 *   the interest confirmed with its payment, and its day, privacy and owner,
 *   so the interest sits in the payment's month and is hidden from whoever
 *   the payment is hidden from;
 * - it joins the split back (deletes the interest) once the row is no longer a
 *   payment into that loan: moved to another account (a deleted loan account
 *   only unlinks it: the interest stays, as a plain expense), turned into an expense,
 *   put in another currency than the interest's, or its amount cut below the
 *   interest.
 *
 * Interest on a filed tax return is never removed by any of that: deleting it
 * (the join back above, or the cascade of its payment going) is refused while
 * the workspace stands, and so is moving its payment to another day or making
 * it private. The application refuses those edits first, with the reason.
 *
 * Posting to the ledger follows the payment too: trashing or restoring the
 * payment's statement queues its interest like the statement's own rows.
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
        interest_currency text;
      BEGIN
        SELECT SUM(COALESCE("amount", "debit", "credit", 0)), MIN(upper(trim("currency")))
          INTO interest, interest_currency
          FROM "transactions"
         WHERE "loan_interest_of_id" = NEW."id" AND "workspace_id" = NEW."workspace_id";
        IF interest IS NULL THEN
          RETURN NULL;
        END IF;
        -- The loan account was deleted (its rows' wallet set NULL): the interest
        -- stays, as a plain expense with no account, like the payment.
        IF NEW."wallet_id" IS NULL AND OLD."wallet_id" IS NOT NULL THEN
          UPDATE "transactions" SET "loan_interest_of_id" = NULL
           WHERE "loan_interest_of_id" = NEW."id" AND "workspace_id" = NEW."workspace_id";
          RETURN NULL;
        END IF;
        IF NEW."wallet_id" IS DISTINCT FROM OLD."wallet_id"
           OR NEW."transaction_type" <> 'income'
           OR upper(trim(NEW."currency")) <> interest_currency
           OR COALESCE(NEW."amount", NEW."credit", NEW."debit", 0) < interest THEN
          -- A tax-locked interest row refuses this (loan_interest_keep_locked).
          DELETE FROM "transactions"
           WHERE "loan_interest_of_id" = NEW."id" AND "workspace_id" = NEW."workspace_id";
          RETURN NULL;
        END IF;
        IF (NEW."transaction_date", NEW."is_private") IS DISTINCT FROM (OLD."transaction_date", OLD."is_private")
           AND EXISTS (SELECT 1 FROM "transactions"
                        WHERE "loan_interest_of_id" = NEW."id" AND "workspace_id" = NEW."workspace_id"
                          AND "tax_locked") THEN
          RAISE EXCEPTION 'update or delete on table "transactions" refused: the interest of % is on a filed tax return', NEW."id"
            USING ERRCODE = 'foreign_key_violation';
        END IF;
        UPDATE "transactions"
           SET "is_verified" = NEW."is_verified", "is_duplicate" = NEW."is_duplicate",
               "transaction_date" = NEW."transaction_date", "is_private" = NEW."is_private",
               -- A payment without an owner leaves the one the interest took from the account.
               "owner_member_id" = COALESCE(NEW."owner_member_id", "owner_member_id")
         WHERE "loan_interest_of_id" = NEW."id"
           AND "workspace_id" = NEW."workspace_id"
           AND ("is_verified", "is_duplicate", "transaction_date", "is_private", "owner_member_id")
             IS DISTINCT FROM
               (NEW."is_verified", NEW."is_duplicate", NEW."transaction_date", NEW."is_private",
                COALESCE(NEW."owner_member_id", "owner_member_id"));
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
        AFTER UPDATE OF "is_verified", "is_duplicate", "wallet_id", "transaction_type", "amount", "debit", "credit",
                        "currency", "transaction_date", "is_private", "owner_member_id"
        ON "transactions"
        FOR EACH ROW
        WHEN (
          OLD."loan_interest_of_id" IS NULL
          AND (OLD."is_verified", OLD."is_duplicate", OLD."wallet_id", OLD."transaction_type", OLD."amount",
               OLD."debit", OLD."credit", OLD."currency", OLD."transaction_date", OLD."is_private",
               OLD."owner_member_id")
            IS DISTINCT FROM
              (NEW."is_verified", NEW."is_duplicate", NEW."wallet_id", NEW."transaction_type", NEW."amount",
               NEW."debit", NEW."credit", NEW."currency", NEW."transaction_date", NEW."is_private",
               NEW."owner_member_id")
        )
        EXECUTE FUNCTION "loan_interest_follow_payment"()
    `);
    // Interest on a filed return goes only with its workspace. The workspace
    // row is already gone when its own delete cascades here.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "loan_interest_keep_locked"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "workspaces" WHERE "id" = OLD."workspace_id") THEN
          RAISE EXCEPTION 'update or delete on table "transactions" refused: interest % is on a filed tax return', OLD."id"
            USING ERRCODE = 'foreign_key_violation';
        END IF;
        RETURN OLD;
      END;
      $$
    `);
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_transactions_loan_interest_locked" ON "transactions"',
    );
    await queryRunner.query(`
      CREATE TRIGGER "TRG_transactions_loan_interest_locked"
        BEFORE DELETE ON "transactions"
        FOR EACH ROW
        WHEN (OLD."loan_interest_of_id" IS NOT NULL AND OLD."tax_locked")
        EXECUTE FUNCTION "loan_interest_keep_locked"()
    `);
    // The ledger books interest by its payment's statement (ledger-posting,
    // moved-rows): queue it when that statement goes to the trash or comes back.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "loan_interest_follow_statement"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE "transactions" interest
           SET "ledger_dirty" = true, "ledger_error" = NULL, "ledger_attempted_at" = NULL
          FROM "transactions" payment
         WHERE payment."statement_id" = NEW."id"
           AND interest."loan_interest_of_id" = payment."id"
           AND interest."workspace_id" = payment."workspace_id";
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_statements_loan_interest_dirty" ON "statements"',
    );
    await queryRunner.query(`
      CREATE TRIGGER "TRG_statements_loan_interest_dirty"
        AFTER UPDATE OF "deleted_at" ON "statements"
        FOR EACH ROW
        WHEN (OLD."deleted_at" IS DISTINCT FROM NEW."deleted_at")
        EXECUTE FUNCTION "loan_interest_follow_statement"()
    `);
  }

  /**
   * The schema goes; the interest rows stay, as plain expenses: deleting them
   * would change balances and spending on a rollback. They can no longer be
   * joined back from the loan page.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_statements_loan_interest_dirty" ON "statements"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS "loan_interest_follow_statement"()');
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_transactions_loan_interest_locked" ON "transactions"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS "loan_interest_keep_locked"()');
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
