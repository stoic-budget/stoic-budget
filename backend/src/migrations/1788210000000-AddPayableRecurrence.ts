import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bills that repeat: a rule (`recurrence`), the series every occurrence of it
 * belongs to and the day the rule put it on (kept when one occurrence is moved,
 * so the series does not move with it), the amount of the series when one
 * occurrence was changed alone, skipping, and how many days before the due
 * date to remind. One row per series and occurrence day, so two scheduler runs
 * cannot both create the same one.
 *
 * Old "recurring" flags become a rule from the newest flagged bill of each
 * vendor (same workspace, direction, vendor and currency): one series per
 * vendor, not one per old copy. Its step is guessed from the median gap
 * between the due dates of all that vendor's flagged bills, deleted and
 * settled ones included (`STEP_FROM_GAP`); one bill, or a gap that fits no
 * step, is monthly. Only a bill that is still current converts: not deleted
 * (a deleted newest one means the person dropped it), not archived, no later
 * live bill of the vendor (one entered by hand would be made twice), and due
 * at most 45 days ago. Older flags stay readable as `is_recurring` without a
 * rule. A second run changes nothing: a vendor whose newest bill already has
 * a rule or a series is left alone.
 *
 * "Not this payment": a bank row refused as the payment of a bill or of a
 * subscription is never proposed or linked to it again. A payment's own
 * transaction (cash or a wallet, recorded with it) is marked, since refusing
 * it would leave it in the books; earlier ones are recognised by what the
 * cash payment writes (no statement, the bill's vendor and comment).
 *
 * Subscriptions can charge every two weeks or every six months.
 */
/**
 * Median gap in days → step: a week (5–9), a fortnight (12–16), a quarter
 * (80–101), half a year (165–200), a year (330–400). The bands are the
 * period's length with room for a bill entered a few days early or late
 * (about a tenth of it, two days for the short ones). Anything else, a month
 * (28–31) included, is monthly.
 */
const STEP_FROM_GAP = `
  CASE WHEN m."gap" BETWEEN 5 AND 9 THEN 'weekly'
       WHEN m."gap" BETWEEN 12 AND 16 THEN 'weekly'
       WHEN m."gap" BETWEEN 330 AND 400 THEN 'yearly'
       ELSE 'monthly' END AS "frequency",
  CASE WHEN m."gap" BETWEEN 12 AND 16 THEN 2
       WHEN m."gap" BETWEEN 80 AND 101 THEN 3
       WHEN m."gap" BETWEEN 165 AND 200 THEN 6
       ELSE 1 END AS "interval"`;

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
      WITH flagged AS (
        SELECT "id", "workspace_id", "direction", lower("vendor") AS "vendor_key", "currency",
               "due_date", "status", "deleted_at", "recurrence", "series_id"
          FROM "payables"
         WHERE "is_recurring" AND "due_date" IS NOT NULL
      ),
      gaps AS (
        SELECT "workspace_id", "direction", "vendor_key", "currency",
               "due_date" - lag("due_date") OVER (
                 PARTITION BY "workspace_id", "direction", "vendor_key", "currency"
                 ORDER BY "due_date") AS "gap"
          FROM (SELECT DISTINCT "workspace_id", "direction", "vendor_key", "currency", "due_date"
                  FROM flagged) days
      ),
      medians AS (
        SELECT "workspace_id", "direction", "vendor_key", "currency",
               percentile_cont(0.5) WITHIN GROUP (ORDER BY "gap") AS "gap"
          FROM gaps
         WHERE "gap" IS NOT NULL
         GROUP BY "workspace_id", "direction", "vendor_key", "currency"
      ),
      newest AS (
        SELECT DISTINCT ON ("workspace_id", "direction", "vendor_key", "currency") *
          FROM flagged
         ORDER BY "workspace_id", "direction", "vendor_key", "currency", "due_date" DESC, "id"
      ),
      steps AS (
        SELECT n."id", ${STEP_FROM_GAP}
          FROM newest n
          LEFT JOIN medians m USING ("workspace_id", "direction", "vendor_key", "currency")
         WHERE n."deleted_at" IS NULL
           AND n."status" <> 'archived'
           AND n."recurrence" IS NULL AND n."series_id" IS NULL
           AND n."due_date" >= current_date - 45
           AND NOT EXISTS (
             SELECT 1 FROM "payables" later
              WHERE later."workspace_id" = n."workspace_id"
                AND later."direction" = n."direction"
                AND lower(later."vendor") = n."vendor_key"
                AND later."currency" = n."currency"
                AND later."deleted_at" IS NULL
                AND later."due_date" > n."due_date")
      )
      UPDATE "payables" p
         SET "recurrence" = jsonb_build_object(
               'frequency', s."frequency",
               'interval', s."interval",
               'startDate', to_char(p."due_date", 'YYYY-MM-DD')),
             "series_id" = p."id",
             "occurrence_date" = p."due_date"
        FROM steps s
       WHERE p."id" = s."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "payable_payments"
        ADD COLUMN IF NOT EXISTS "own_transaction" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE "payable_payments" pp
         SET "own_transaction" = true
        FROM "transactions" t, "payables" p
       WHERE t."id" = pp."transaction_id" AND p."id" = pp."payable_id"
         AND NOT pp."own_transaction"
         AND t."statement_id" IS NULL
         AND t."counterparty_name" = p."vendor"
         AND t."payment_purpose" = COALESCE(NULLIF(p."comment", ''), p."vendor")
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
    await queryRunner.query(
      'ALTER TABLE "payable_payments" DROP COLUMN IF EXISTS "own_transaction"',
    );
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
