import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a flat or a car on the balance sheet is (attributes), the debt it was
 * bought with (a loan account or a debt line, never both, and a debt belongs
 * to one property at most), and how fast a car loses value between the
 * values someone enters. A deleted debt unlinks itself.
 */
export class AddBalanceAccountPropertyDetails1788250000000 implements MigrationInterface {
  name = 'AddBalanceAccountPropertyDetails1788250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE balance_accounts ADD COLUMN IF NOT EXISTS attributes jsonb',
    );
    await queryRunner.query(`
      ALTER TABLE balance_accounts
      ADD COLUMN IF NOT EXISTS debt_wallet_id uuid
        REFERENCES wallets(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE balance_accounts
      ADD COLUMN IF NOT EXISTS debt_account_id uuid
        REFERENCES balance_accounts(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE balance_accounts
      ADD COLUMN IF NOT EXISTS depreciation_rate numeric(5,2)
        CHECK (depreciation_rate IS NULL OR (depreciation_rate > 0 AND depreciation_rate <= 100))
    `);
    await queryRunner.query(
      'ALTER TABLE balance_accounts DROP CONSTRAINT IF EXISTS "CHK_balance_accounts_one_debt"',
    );
    await queryRunner.query(`
      ALTER TABLE balance_accounts ADD CONSTRAINT "CHK_balance_accounts_one_debt"
        CHECK (debt_wallet_id IS NULL OR debt_account_id IS NULL)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_accounts_debt_wallet"
      ON balance_accounts (debt_wallet_id) WHERE debt_wallet_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_accounts_debt_account"
      ON balance_accounts (debt_account_id) WHERE debt_account_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_balance_accounts_debt_account"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_balance_accounts_debt_wallet"');
    await queryRunner.query(
      'ALTER TABLE balance_accounts DROP CONSTRAINT IF EXISTS "CHK_balance_accounts_one_debt"',
    );
    await queryRunner.query('ALTER TABLE balance_accounts DROP COLUMN IF EXISTS depreciation_rate');
    await queryRunner.query('ALTER TABLE balance_accounts DROP COLUMN IF EXISTS debt_account_id');
    await queryRunner.query('ALTER TABLE balance_accounts DROP COLUMN IF EXISTS debt_wallet_id');
    await queryRunner.query('ALTER TABLE balance_accounts DROP COLUMN IF EXISTS attributes');
  }
}
