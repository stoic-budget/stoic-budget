import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether an account counts in net worth. Money held for someone else, a
 * child's account or a business float stays in cash flow and budgets but is
 * not the household's wealth. Every existing account keeps counting.
 */
export class AddWalletIncludeInNetWorth1788510000000 implements MigrationInterface {
  name = 'AddWalletIncludeInNetWorth1788510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "include_in_net_worth" boolean NOT NULL DEFAULT true',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "wallets" DROP COLUMN IF EXISTS "include_in_net_worth"');
  }
}
