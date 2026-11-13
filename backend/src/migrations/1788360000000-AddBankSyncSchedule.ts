import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bank sync stops pulling every connection on one fixed six-hour cron. Each
 * connection now carries how often it is pulled (1 to 24 hours), when it is due
 * next, the lease a running pull holds, and the backoff after failed pulls.
 *
 * The connections that exist get a first due time spread over the next six
 * hours, the cadence they had: due all at once, the first tick after the deploy
 * would pull every connection of the instance together.
 */
export class AddBankSyncSchedule1788360000000 implements MigrationInterface {
  name = 'AddBankSyncSchedule1788360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "open_protocol_settings"
        ADD COLUMN IF NOT EXISTS "sync_interval_hours" smallint NOT NULL DEFAULT 6,
        ADD COLUMN IF NOT EXISTS "next_pull_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "pull_lease_until" timestamptz,
        ADD COLUMN IF NOT EXISTS "last_pull_attempt_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "consecutive_failures" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "backoff_until" timestamptz,
        ADD COLUMN IF NOT EXISTS "backoff_reason" varchar(500)
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_open_protocol_settings_sync_interval'
        ) THEN
          ALTER TABLE "open_protocol_settings"
            ADD CONSTRAINT "CHK_open_protocol_settings_sync_interval"
            CHECK ("sync_interval_hours" BETWEEN 1 AND 24);
        END IF;
      END $$
    `);
    await queryRunner.query(`
      UPDATE "open_protocol_settings" s
      SET "next_pull_at" = now() + random() * interval '6 hours'
      FROM "integrations" i
      WHERE i."id" = s."integration_id"
        AND i."provider" IN ('simplefin', 'enablebanking')
        AND s."next_pull_at" IS NULL
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_open_protocol_settings_next_pull_at" ON "open_protocol_settings" ("next_pull_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_open_protocol_settings_next_pull_at"');
    await queryRunner.query(`
      ALTER TABLE "open_protocol_settings"
        DROP CONSTRAINT IF EXISTS "CHK_open_protocol_settings_sync_interval",
        DROP COLUMN IF EXISTS "backoff_reason",
        DROP COLUMN IF EXISTS "backoff_until",
        DROP COLUMN IF EXISTS "consecutive_failures",
        DROP COLUMN IF EXISTS "last_pull_attempt_at",
        DROP COLUMN IF EXISTS "pull_lease_until",
        DROP COLUMN IF EXISTS "next_pull_at",
        DROP COLUMN IF EXISTS "sync_interval_hours"
    `);
  }
}
