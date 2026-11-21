import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a row leave every income and spending figure while it stays real money.
 *
 * A one-off (a car bought from savings, a work trip the employer pays back)
 * would otherwise blow up a budget, a report or the forecast baseline. The row
 * keeps counting in its account's balance, in net worth and in tax: the flag is
 * read by the flows predicate only (`onlyFlows` / `flowsSql`), never by
 * `onlyCounted`. It sits beside the transfer link rather than being a kind of
 * row, so a transfer leg or a private row can be left out of budgets as well.
 */
export class AddTransactionExcludedFromBudgets1788160000000 implements MigrationInterface {
  name = 'AddTransactionExcludedFromBudgets1788160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "excluded_from_budgets" boolean NOT NULL DEFAULT false',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" DROP COLUMN IF EXISTS "excluded_from_budgets"',
    );
  }
}
