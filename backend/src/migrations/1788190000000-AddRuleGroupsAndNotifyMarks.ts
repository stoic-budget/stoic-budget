import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Folders on the rules page, and the record of which new rows a rule already
 * told people about.
 *
 * A folder only groups rules for reading: which rule wins a row stays the one
 * global priority order, so `rule_groups.position` orders folders and nothing
 * else. Deleting a folder leaves its rules outside any folder.
 *
 * `rule_notify_marks` holds one key per rule and row (the row's fingerprint,
 * else its statement and document number, else its id), claimed with
 * `ON CONFLICT DO NOTHING` before a notification is sent: the same row imported
 * again never notifies twice, and two imports at once cannot both send. It is
 * bookkeeping, not workspace data to back up, so it has no entity.
 */
export class AddRuleGroupsAndNotifyMarks1788190000000 implements MigrationInterface {
  name = 'AddRuleGroupsAndNotifyMarks1788190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rule_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_rule_groups_workspace" ON "rule_groups" ("workspace_id", "position")',
    );
    await queryRunner.query(
      'ALTER TABLE "categorization_rules" ADD COLUMN IF NOT EXISTS "group_id" uuid REFERENCES "rule_groups"("id") ON DELETE SET NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_categorization_rules_group" ON "categorization_rules" ("group_id")',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rule_notify_marks" (
        "rule_id" uuid NOT NULL REFERENCES "categorization_rules"("id") ON DELETE CASCADE,
        "row_key" varchar(200) NOT NULL,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("rule_id", "row_key")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_rule_notify_marks_workspace" ON "rule_notify_marks" ("workspace_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "rule_notify_marks"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_categorization_rules_group"');
    await queryRunner.query('ALTER TABLE "categorization_rules" DROP COLUMN IF EXISTS "group_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "rule_groups"');
  }
}
