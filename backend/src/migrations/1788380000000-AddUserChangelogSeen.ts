import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The newest changelog entry each user has seen: its id and its date, which orders
 * entries. Existing accounts stay NULL and see the latest release once; the default,
 * set only after the column exists, starts every new account at its sign-up time, so
 * nobody is greeted with releases from before they joined.
 */
export class AddUserChangelogSeen1788380000000 implements MigrationInterface {
  name = 'AddUserChangelogSeen1788380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "changelog_seen_id" character varying(80)',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "changelog_seen_at" TIMESTAMP WITH TIME ZONE',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "changelog_seen_at" SET DEFAULT now()',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "changelog_seen_at"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "changelog_seen_id"');
  }
}
