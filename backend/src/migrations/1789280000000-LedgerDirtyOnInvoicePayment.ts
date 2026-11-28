import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bank row that pays an invoice is booked against receivables, any other
 * income row against its category (`planTransaction`). Whether it pays one
 * lives in `payables.linked_transaction_id` and `payable_payments`, so a
 * payment linked to a row that was already booked left the category posting
 * in place: revenue counted twice and the receivable stayed open (#630).
 *
 * These triggers queue the rows on both sides of every such link for the
 * posting worker, as the triggers on `transactions` do for the row's own
 * facts: a payment added, moved or removed, an invoice linked, unlinked,
 * created already linked, deleted or restored, or turned into another kind
 * of payable. `up` can run again: each trigger is dropped before it is made.
 */
export class LedgerDirtyOnInvoicePayment1789280000000 implements MigrationInterface {
  name = 'LedgerDirtyOnInvoicePayment1789280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_mark_rows_dirty"(ids uuid[]) RETURNS void
      LANGUAGE sql AS $$
        UPDATE "transactions"
           SET "ledger_dirty" = true, "ledger_error" = NULL, "ledger_attempted_at" = NULL
         WHERE "id" = ANY(ids) AND NOT ("ledger_dirty" AND "ledger_error" IS NULL)
      $$
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_mark_payment_rows_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM "ledger_mark_rows_dirty"(ARRAY[NEW."transaction_id"]);
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM "ledger_mark_rows_dirty"(ARRAY[OLD."transaction_id"]);
        ELSIF (NEW."transaction_id", NEW."payable_id") IS DISTINCT FROM (OLD."transaction_id", OLD."payable_id") THEN
          PERFORM "ledger_mark_rows_dirty"(ARRAY[OLD."transaction_id", NEW."transaction_id"]);
        END IF;
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_payable_payments_ledger_dirty" ON "payable_payments"`,
    );
    await queryRunner.query(`
      CREATE TRIGGER "TRG_payable_payments_ledger_dirty"
      AFTER INSERT OR UPDATE OR DELETE ON "payable_payments"
      FOR EACH ROW EXECUTE FUNCTION "ledger_mark_payment_rows_dirty"()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "ledger_mark_payable_rows_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        -- Created already linked, or deleted outright (its payment rows mark
        -- themselves as the cascade removes them).
        IF TG_OP = 'INSERT' THEN
          PERFORM "ledger_mark_rows_dirty"(ARRAY[NEW."linked_transaction_id"]);
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM "ledger_mark_rows_dirty"(ARRAY[OLD."linked_transaction_id"]);
        ELSIF (NEW."linked_transaction_id", NEW."source", NEW."deleted_at" IS NULL)
           IS DISTINCT FROM (OLD."linked_transaction_id", OLD."source", OLD."deleted_at" IS NULL)
        THEN
          PERFORM "ledger_mark_rows_dirty"(
            ARRAY[OLD."linked_transaction_id", NEW."linked_transaction_id"]
            || ARRAY(SELECT "transaction_id" FROM "payable_payments" WHERE "payable_id" = NEW."id")
          );
        END IF;
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_payables_ledger_dirty" ON "payables"`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_payables_ledger_dirty"
      AFTER INSERT OR UPDATE OR DELETE ON "payables"
      FOR EACH ROW EXECUTE FUNCTION "ledger_mark_payable_rows_dirty"()
    `);
    // Rows already booked against a category while an invoice says they pay
    // it: queued once, so the worker rebuilds them against receivables.
    await queryRunner.query(`
      SELECT "ledger_mark_rows_dirty"(ARRAY(
        SELECT p."linked_transaction_id" FROM "payables" p
         WHERE p."source" = 'invoice' AND p."deleted_at" IS NULL AND p."linked_transaction_id" IS NOT NULL
        UNION
        SELECT pp."transaction_id" FROM "payable_payments" pp
          JOIN "payables" p ON p."id" = pp."payable_id"
         WHERE p."source" = 'invoice' AND p."deleted_at" IS NULL AND pp."transaction_id" IS NOT NULL
      ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_payables_ledger_dirty" ON "payables"`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_payable_payments_ledger_dirty" ON "payable_payments"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_mark_payable_rows_dirty"()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_mark_payment_rows_dirty"()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "ledger_mark_rows_dirty"(uuid[])`);
  }
}
