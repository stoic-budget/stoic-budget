import { MigrationInterface, QueryRunner } from 'typeorm';

/** Each member keeps their own interface language per workspace; null = the user's. */
export class AddWorkspaceMemberLocale1789210000000 implements MigrationInterface {
  name = 'AddWorkspaceMemberLocale1789210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "locale" varchar(8)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "workspace_members" DROP COLUMN IF EXISTS "locale"');
  }
}
