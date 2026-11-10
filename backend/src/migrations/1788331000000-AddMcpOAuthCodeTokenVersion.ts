import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The session token version an authorization code was approved under: a code
 * from a session a password reset (or "log out everywhere") ended is refused
 * at exchange, even one minted while the reset was running.
 */
export class AddMcpOAuthCodeTokenVersion1788331000000 implements MigrationInterface {
  name = 'AddMcpOAuthCodeTokenVersion1788331000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "mcp_oauth_codes" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "mcp_oauth_codes" DROP COLUMN IF EXISTS "token_version"');
  }
}
