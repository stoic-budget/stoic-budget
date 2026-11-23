import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Earlier limits of a budget, each with the day it stopped applying, so
 * rollover counts a past period at the limit it had. Budgets changed before
 * this have no history and keep counting at their current limit.
 */
export class AddBudgetLimitHistory1789240000000 implements MigrationInterface {
  name = 'AddBudgetLimitHistory1789240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD COLUMN "limit_history" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN "limit_history"`);
  }
}
