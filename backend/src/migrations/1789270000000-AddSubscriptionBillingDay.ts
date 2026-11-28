import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The day of the month a subscription is billed on (#662). Stepping from the
 * last charge date alone drifts: 31 Jan clamps to 28 Feb, then stays on the
 * 28th. Filled from the next charge date, or from the last charge when the
 * next one sits on a clamped month end; a row that already drifted keeps its
 * drifted day.
 */
export class AddSubscriptionBillingDay1789270000000 implements MigrationInterface {
  name = 'AddSubscriptionBillingDay1789270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "billing_day" smallint NULL
         CONSTRAINT "CHK_subscriptions_billing_day" CHECK ("billing_day" BETWEEN 1 AND 31)`,
    );
    // A next date on the last day of its month may be a clamp (30 Nov for the
    // 31st): the last charge's day, when later, is the billing day then.
    await queryRunner.query(
      `UPDATE "subscriptions" SET "billing_day" = CASE
          WHEN "next_charge_date" = (date_trunc('month', "next_charge_date") + interval '1 month - 1 day')::date
           AND "last_charge_date" IS NOT NULL
          THEN GREATEST(EXTRACT(DAY FROM "next_charge_date"), EXTRACT(DAY FROM "last_charge_date"))
          ELSE EXTRACT(DAY FROM "next_charge_date")
        END
        WHERE "next_charge_date" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "billing_day"`);
  }
}
