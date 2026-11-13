import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The last time a person held an account's balance against the bank's figure
 * and it matched: the day and the bank's balance. Both empty until then.
 *
 * And a balance adjustment (a one-leg pair of kind 'adjustment') never holds a
 * category or a tax mark, whichever path writes it (a rule, a bulk edit, a
 * restore): either would put it in the tax figures and the ledger's profit and
 * loss. The app refuses a person's edit with a message; this is the backstop.
 */
export class AddWalletBalanceCheck1788530000000 implements MigrationInterface {
  name = 'AddWalletBalanceCheck1788530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "balance_checked_at" date',
    );
    await queryRunner.query(
      'ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "balance_checked_amount" numeric(15,2)',
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "transactions_adjustment_uncategorised"() RETURNS trigger AS $$
      BEGIN
        NEW."category_id" := NULL;
        NEW."private_category_id" := NULL;
        NEW."tax_rate_id" := NULL;
        NEW."tax_rule_id" := NULL;
        NEW."tax_amount" := NULL;
        NEW."tax_net_amount" := NULL;
        NEW."tax_notional_amount" := NULL;
        NEW."tax_source" := NULL;
        NEW."tax_relevant" := NULL;
        NEW."tax_reverse_charge" := false;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    // Named to sort before "TRG_transactions_ledger_dirty": BEFORE triggers fire in name order, so the
    // ledger sees the cleared category and marks the row dirty.
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "trg_transactions_adjustment_uncategorised" ON "transactions"',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_transactions_adjustment_uncategorised" ON "transactions"',
    );
    await queryRunner.query(`
      CREATE TRIGGER "TRG_transactions_adjustment_uncategorised"
        BEFORE INSERT OR UPDATE ON "transactions"
        FOR EACH ROW WHEN (NEW."transfer_pair_kind" = 'adjustment')
        EXECUTE FUNCTION "transactions_adjustment_uncategorised"()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TRG_transactions_adjustment_uncategorised" ON "transactions"',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "trg_transactions_adjustment_uncategorised" ON "transactions"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS "transactions_adjustment_uncategorised"()');
    await queryRunner.query('ALTER TABLE "wallets" DROP COLUMN IF EXISTS "balance_checked_amount"');
    await queryRunner.query('ALTER TABLE "wallets" DROP COLUMN IF EXISTS "balance_checked_at"');
  }
}
