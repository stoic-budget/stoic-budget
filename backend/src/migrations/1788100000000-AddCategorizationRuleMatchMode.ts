import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether a categorization rule asks for all of its conditions or for any one
 * of them. Every rule saved so far asked for all.
 */
export class AddCategorizationRuleMatchMode1788100000000 implements MigrationInterface {
  name = 'AddCategorizationRuleMatchMode1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categorization_rules"
         ADD COLUMN IF NOT EXISTS "match_mode" character varying(8) NOT NULL DEFAULT 'all'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "categorization_rules" DROP COLUMN IF EXISTS "match_mode"',
    );
  }
}
