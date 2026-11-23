import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The day of the month a subscription is billed on (#662). Stepping from the
 * last charge date alone drifts: 31 Jan clamps to 28 Feb, then stays on the
 * 28th. Filled from the next charge date, the best day known for rows that
 * have one (a row that already drifted keeps its drifted day).
 */
export class AddSubscriptionBillingDay1789270000000 implements MigrationInterface {
  name = 'AddSubscriptionBillingDay1789270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "billing_day" smallint NULL
         CONSTRAINT "CHK_subscriptions_billing_day" CHECK ("billing_day" BETWEEN 1 AND 31)`,
    );
    await queryRunner.query(
      `UPDATE "subscriptions" SET "billing_day" = EXTRACT(DAY FROM "next_charge_date")
        WHERE "next_charge_date" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "billing_day"`);
  }
}
