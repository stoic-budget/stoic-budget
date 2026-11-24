import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accounts deleted before deletion forgot the person (#642) still hold their
 * e-mail, so registering again with it failed on the unique index with a 500,
 * and single sign-on hit the identity's unique key. They get what a deletion
 * does now (`forgetDeletedAccount`): a placeholder address and name, no
 * password, contact details or second factor, and no sign-on identities.
 * Not reversible: the old values are not kept anywhere.
 */
export class ForgetDeletedAccounts1789290000000 implements MigrationInterface {
  name = 'ForgetDeletedAccounts1789290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_identities"
       WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL)
    `);
    await queryRunner.query(`
      UPDATE "users"
         SET "email" = 'deleted-' || "id" || '@deleted.invalid',
             "name" = 'Deleted user',
             "password_hash" = '',
             "company" = NULL,
             "avatar_url" = NULL,
             "telegram_id" = NULL,
             "telegram_chat_id" = NULL,
             "telegram_workspace_id" = NULL,
             "two_factor_secret" = NULL,
             "two_factor_recovery_codes" = '[]'::jsonb
       WHERE "deleted_at" IS NOT NULL AND "email" NOT LIKE 'deleted-%@deleted.invalid'
    `);
  }

  public async down(): Promise<void> {
    // The forgotten values are gone; nothing to put back.
  }
}
