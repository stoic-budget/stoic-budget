import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bills that repeat: a rule (`recurrence`), the series every occurrence of it
 * belongs to and the day the rule put it on (kept when one occurrence is moved,
 * so the series does not move with it), the amount of the series when one
 * occurrence was changed alone, skipping, and how many days before the due
 * date to remind. One row per series and occurrence day, so two scheduler runs
 * cannot both create the same one.
 *
 * Old "recurring" flags become a monthly rule from their due date, for the
 * newest bill of each vendor only (one series per vendor, not one per old
 * copy) and only where its due date is at most 45 days old, open or paid, so a
 * long-forgotten bill does not come back as a run of overdue ones (the job
 * makes every missed month of an open series). Older flags stay readable as
 * `is_recurring` without a rule.
 *
 * "Not this payment": a bank row refused as the payment of a bill or of a
 * subscription is never proposed or linked to it again.
 *
 * Subscriptions can charge every two weeks or every six months.
 */
export class AddPayableRecurrence1788210000000 implements MigrationInterface {
  name = 'AddPayableRecurrence1788210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payables"
        ADD COLUMN IF NOT EXISTS "recurrence" jsonb,
        ADD COLUMN IF NOT EXISTS "remind_days_before" integer NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "series_id" uuid,
        ADD COLUMN IF NOT EXISTS "occurrence_date" date,
        ADD COLUMN IF NOT EXISTS "base_amount" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "skipped_at" timestamptz
    `);
    await queryRunner.query(
      'ALTER TABLE "payables" DROP CONSTRAINT IF EXISTS "CHK_payables_remind_days_before"',
    );
    await queryRunner.query(`
      ALTER TABLE "payables" ADD CONSTRAINT "CHK_payables_remind_days_before"
        CHECK ("remind_days_before" BETWEEN 0 AND 60)
    `);
    // Deleted occurrences keep their day: a series never re-creates one a person removed.
    // Per workspace: a restored copy of a workspace keeps the series ids of its bills.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payables_series_occurrence"
        ON "payables" ("workspace_id", "series_id", "occurrence_date")
        WHERE "series_id" IS NOT NULL
    `);
    await queryRunner.query(`
      WITH newest AS (
        SELECT DISTINCT ON ("workspace_id", "direction", lower("vendor"), "currency") "id"
          FROM "payables"
         WHERE "is_recurring" AND "recurrence" IS NULL AND "due_date" IS NOT NULL
           AND "deleted_at" IS NULL
         ORDER BY "workspace_id", "direction", lower("vendor"), "currency", "due_date" DESC, "id"
      )
      UPDATE "payables" p
         SET "recurrence" = jsonb_build_object(
               'frequency', 'monthly',
               'interval', 1,
               'startDate', to_char(p."due_date", 'YYYY-MM-DD')),
             "series_id" = p."id",
             "occurrence_date" = p."due_date"
        FROM newest
       WHERE p."id" = newest."id"
         AND p."due_date" >= current_date - 45
    `);

    // Subscriptions get the fortnightly and half-yearly steps of the shared rules.
    await queryRunner.query(
      `ALTER TYPE "subscription_frequency_enum" ADD VALUE IF NOT EXISTS 'biweekly'`,
    );
    await queryRunner.query(
      `ALTER TYPE "subscription_frequency_enum" ADD VALUE IF NOT EXISTS 'semiannual'`,
    );

    for (const [table, owner, ownerTable] of [
      ['payable_match_rejections', 'payable_id', 'payables'],
      ['subscription_match_rejections', 'subscription_id', 'subscriptions'],
    ] as const) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${table}" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "workspace_id" uuid NOT NULL,
          "${owner}" uuid NOT NULL,
          "transaction_id" uuid NOT NULL,
          "created_by_id" uuid,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_${table}" PRIMARY KEY ("id"),
          CONSTRAINT "FK_${table}_workspace" FOREIGN KEY ("workspace_id")
            REFERENCES "workspaces"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_${table}_owner" FOREIGN KEY ("${owner}")
            REFERENCES "${ownerTable}"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_${table}_transaction" FOREIGN KEY ("transaction_id")
            REFERENCES "transactions"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_${table}_created_by" FOREIGN KEY ("created_by_id")
            REFERENCES "users"("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_${table}_pair" ON "${table}" ("${owner}", "transaction_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${table}_workspace" ON "${table}" ("workspace_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${table}_transaction" ON "${table}" ("transaction_id")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres cannot drop an enum value; 'biweekly' and 'semiannual' stay in the type.
    await queryRunner.query('DROP TABLE IF EXISTS "subscription_match_rejections"');
    await queryRunner.query('DROP TABLE IF EXISTS "payable_match_rejections"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_payables_series_occurrence"');
    await queryRunner.query(
      'ALTER TABLE "payables" DROP CONSTRAINT IF EXISTS "CHK_payables_remind_days_before"',
    );
    await queryRunner.query(`
      ALTER TABLE "payables"
        DROP COLUMN IF EXISTS "skipped_at",
        DROP COLUMN IF EXISTS "base_amount",
        DROP COLUMN IF EXISTS "occurrence_date",
        DROP COLUMN IF EXISTS "series_id",
        DROP COLUMN IF EXISTS "remind_days_before",
        DROP COLUMN IF EXISTS "recurrence"
    `);
  }
}
