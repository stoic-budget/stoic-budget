import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Keeps a bank-sync row the bank still holds as pending (a card authorisation
 * not yet booked) instead of dropping it at the pull.
 *
 * A pending row is shown, dimmed, but counts nowhere: the counted predicate
 * (`onlyCounted` / `countedSql` / `countedWhere`, and so `onlyFlows`) leaves it
 * out of balances, budgets, reports, tax and the Review queue. When the booked
 * version arrives the pull turns the row into it, keeping what the user edited;
 * a row that never books is removed after two weeks.
 *
 * The partial index serves the pull's lookup of an account's pending rows,
 * which are few, without growing the index over every booked row.
 *
 * The ledger books no pending row, approved or not, so the bank booking it has
 * to queue it for the posting worker: `is_pending` joins the dirty-marking
 * fingerprint of `ledger_mark_transaction_dirty` (as `is_verified` did in
 * 1786910000000). The trigger calls the function by name.
 *
 * Rolling back deletes the pending rows first: without the column they would
 * become ordinary rows, counted once approved, beside their booked versions.
 */
export class AddTransactionIsPending1789080000000 implements MigrationInterface {
  name = 'AddTransactionIsPending1789080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "is_pending" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_pending" ON "transactions" ("workspace_id") WHERE "is_pending" = true',
    );
    await queryRunner.query(markDirtyFunction(true));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(markDirtyFunction(false));
    await queryRunner.query('DELETE FROM "transactions" WHERE "is_pending" = true');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_transactions_workspace_pending"');
    await queryRunner.query('ALTER TABLE "transactions" DROP COLUMN IF EXISTS "is_pending"');
  }
}

/** The function of 1786910000000-LedgerDirtyOnConfirmation, with or without `is_pending`. */
function markDirtyFunction(withPending: boolean): string {
  const pending = (row: 'NEW' | 'OLD') => (withPending ? `, ${row}."is_pending"` : '');
  return `
      CREATE OR REPLACE FUNCTION "ledger_mark_transaction_dirty"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT'
           OR (NEW."workspace_id", NEW."transaction_type", NEW."amount", NEW."debit", NEW."credit",
               NEW."currency", NEW."transaction_date", NEW."tax_amount", NEW."tax_reverse_charge",
               NEW."tax_notional_amount", NEW."is_duplicate", NEW."crypto_wallet_id",
               NEW."category_id", NEW."branch_id", NEW."statement_id", NEW."wallet_id",
               NEW."is_verified"${pending('NEW')})
              IS DISTINCT FROM
              (OLD."workspace_id", OLD."transaction_type", OLD."amount", OLD."debit", OLD."credit",
               OLD."currency", OLD."transaction_date", OLD."tax_amount", OLD."tax_reverse_charge",
               OLD."tax_notional_amount", OLD."is_duplicate", OLD."crypto_wallet_id",
               OLD."category_id", OLD."branch_id", OLD."statement_id", OLD."wallet_id",
               OLD."is_verified"${pending('OLD')})
        THEN
          NEW."ledger_dirty" := true;
          NEW."ledger_error" := NULL;
          NEW."ledger_attempted_at" := NULL;
        END IF;
        RETURN NEW;
      END;
      $$
    `;
}
