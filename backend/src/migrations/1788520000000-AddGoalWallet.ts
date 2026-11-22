import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A goal can follow an account: its progress is then that account's balance
 * instead of the sum of its contributions. Deleting the account sets the link
 * back to NULL, so the goal quietly returns to counting its contributions.
 */
export class AddGoalWallet1788520000000 implements MigrationInterface {
  name = 'AddGoalWallet1788520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "wallet_id" uuid');
    await queryRunner.query('ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "FK_goals_wallet"');
    await queryRunner.query(`
      ALTER TABLE "goals" ADD CONSTRAINT "FK_goals_wallet"
      FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_goals_wallet" ON "goals" ("wallet_id") WHERE "wallet_id" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_goals_wallet"');
    await queryRunner.query('ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "FK_goals_wallet"');
    await queryRunner.query('ALTER TABLE "goals" DROP COLUMN IF EXISTS "wallet_id"');
  }
}
