import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A member's calendar feed: one per member and workspace, read by calendar
 * apps through a secret link. Only the link's SHA-256 is kept, so the link is
 * shown once; a new one replaces the hash and the old link stops working.
 * Removing the member (or the workspace) removes the feed with it.
 */
export class AddCalendarFeeds1788220000000 implements MigrationInterface {
  name = 'AddCalendarFeeds1788220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_feeds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "member_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "include_payables" boolean NOT NULL DEFAULT true,
        "include_subscriptions" boolean NOT NULL DEFAULT true,
        "include_tax_deadlines" boolean NOT NULL DEFAULT true,
        "include_invoices" boolean NOT NULL DEFAULT true,
        "last_fetched_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_feeds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_calendar_feeds_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_calendar_feeds_member" FOREIGN KEY ("member_id")
          REFERENCES "workspace_members"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_calendar_feeds_member"
        ON "calendar_feeds" ("workspace_id", "member_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_calendar_feeds_token_hash"
        ON "calendar_feeds" ("token_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "calendar_feeds"');
  }
}
