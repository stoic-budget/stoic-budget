import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sign-in through an OpenID Connect provider. One row per provider account,
 * unique by issuer and subject so one provider account opens one user only.
 * `users.password_set` says whether the owner knows a password: an account
 * made by single sign-on has a random one until a reset sets theirs, and its
 * last identity cannot be unlinked before that.
 */
export class CreateUserIdentities1788400000000 implements MigrationInterface {
  name = 'CreateUserIdentities1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_identities" (
        "id"           uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"      uuid         NOT NULL,
        "issuer"       varchar(512) NOT NULL,
        "subject"      varchar(255) NOT NULL,
        "email"        varchar(320) NULL,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "last_used_at" TIMESTAMPTZ  NULL,
        CONSTRAINT "PK_user_identities" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_identities_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_identities_issuer_subject"
        ON "user_identities" ("issuer", "subject")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_identities_user_id"
        ON "user_identities" ("user_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "password_set" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "password_set"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_identities"');
  }
}
