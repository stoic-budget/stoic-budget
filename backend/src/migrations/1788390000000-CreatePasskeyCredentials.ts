import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Passkeys (WebAuthn credentials) people register to sign in with. Per person,
 * not per workspace: no workspace column, so backups and versions leave them out.
 */
export class CreatePasskeyCredentials1788390000000 implements MigrationInterface {
  name = 'CreatePasskeyCredentials1788390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "passkey_credentials" (
        "id"            uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"       uuid         NOT NULL,
        "credential_id" text         NOT NULL,
        "public_key"    bytea        NOT NULL,
        "sign_count"    bigint       NOT NULL DEFAULT 0,
        "transports"    text[]       NOT NULL DEFAULT '{}',
        "backed_up"     boolean      NOT NULL DEFAULT false,
        "device_type"   varchar(16)  NOT NULL,
        "name"          varchar(60)  NOT NULL,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "last_used_at"  TIMESTAMPTZ  NULL,
        CONSTRAINT "PK_passkey_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_passkey_credentials_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_passkey_credentials_sign_count" CHECK ("sign_count" >= 0)
      )
    `);

    // Sign-in looks a credential up by its id, and an id names one key: unique.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_passkey_credentials_credential_id"
        ON "passkey_credentials" ("credential_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_passkey_credentials_user_id"
        ON "passkey_credentials" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "passkey_credentials"`);
  }
}
