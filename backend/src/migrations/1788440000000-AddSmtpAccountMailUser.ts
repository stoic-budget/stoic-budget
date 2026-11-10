import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whose account mail a workspace SMTP server may send, set only by a save that
 * checked that person's password. Existing rows stay null on purpose: a row
 * restored from a backup carries the restorer as `updated_by_user_id` without
 * any password, and nothing tells it apart from a real save, so account mail
 * goes through SMTP_* until the owner saves the server again.
 */
export class AddSmtpAccountMailUser1788440000000 implements MigrationInterface {
  name = 'AddSmtpAccountMailUser1788440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "workspace_service_settings" ADD COLUMN IF NOT EXISTS "account_mail_user_id" uuid',
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_workspace_service_settings_account_mail_user'
        ) THEN
          ALTER TABLE "workspace_service_settings"
          ADD CONSTRAINT "FK_workspace_service_settings_account_mail_user"
          FOREIGN KEY ("account_mail_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "workspace_service_settings" DROP CONSTRAINT IF EXISTS "FK_workspace_service_settings_account_mail_user"',
    );
    await queryRunner.query(
      'ALTER TABLE "workspace_service_settings" DROP COLUMN IF EXISTS "account_mail_user_id"',
    );
  }
}
