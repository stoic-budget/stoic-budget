import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Instance settings held only secrets until now; whether sign-up is open is not one. */
export class AddInstanceSettingValue1788140000000 implements MigrationInterface {
  name = 'AddInstanceSettingValue1788140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "value" jsonb',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "instance_settings" DROP COLUMN IF EXISTS "value"');
  }
}
