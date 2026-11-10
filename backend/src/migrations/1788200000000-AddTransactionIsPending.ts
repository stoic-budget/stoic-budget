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
 */
export class AddTransactionIsPending1788200000000 implements MigrationInterface {
  name = 'AddTransactionIsPending1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "is_pending" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_pending" ON "transactions" ("workspace_id") WHERE "is_pending" = true',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_transactions_workspace_pending"');
    await queryRunner.query('ALTER TABLE "transactions" DROP COLUMN IF EXISTS "is_pending"');
  }
}
