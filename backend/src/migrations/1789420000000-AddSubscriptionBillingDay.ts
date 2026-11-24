import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The day of the month a subscription bills on (#596). Stepping the stored
 * next charge one month at a time clamps a 31st to 28 February, and nothing
 * on the row remembered the 31st after that. Backfilled from the last charge,
 * else the next one: a row at "last 31 Jan, next 28 Feb" gets its 31st back.
 * A row that drifted for several months already cannot be told apart and
 * keeps the day it has. Only month-based frequencies have one.
 */
export class AddSubscriptionBillingDay1789420000000 implements MigrationInterface {
  name = 'AddSubscriptionBillingDay1789420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_day" smallint
         CONSTRAINT "CHK_subscriptions_billing_day" CHECK ("billing_day" BETWEEN 1 AND 31)`,
    );
    await queryRunner.query(`
      UPDATE "subscriptions"
         SET "billing_day" = EXTRACT(DAY FROM COALESCE("last_charge_date", "next_charge_date"))
       WHERE "billing_day" IS NULL
         AND "frequency" IN ('monthly', 'quarterly', 'semiannual', 'annual')
         AND COALESCE("last_charge_date", "next_charge_date") IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "billing_day"');
  }
}
