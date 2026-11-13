import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * OAuth 2.1 for the MCP endpoint: clients that registered themselves, the
 * one-minute codes the consent screen hands out, the grants a person approved
 * and the tokens issued under them. Codes and tokens are stored only as
 * SHA-256 hashes. A grant hangs off the membership it was given under, so
 * leaving the workspace, or the workspace going, takes it and its tokens away.
 */
export class CreateMcpOAuth1788330000000 implements MigrationInterface {
  name = 'CreateMcpOAuth1788330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mcp_oauth_clients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "client_name" varchar(200) NOT NULL,
        "redirect_uris" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mcp_oauth_grants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "client_id" uuid NOT NULL REFERENCES "mcp_oauth_clients" ("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
        "workspace_member_id" uuid NOT NULL REFERENCES "workspace_members" ("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "granted_role" varchar(16) NOT NULL,
        "scopes" jsonb NOT NULL,
        "resource" text NOT NULL,
        "last_used_at" timestamptz NULL,
        "revoked_at" timestamptz NULL,
        "revoked_reason" varchar(32) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mcp_oauth_grants_workspace_user"
      ON "mcp_oauth_grants" ("workspace_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mcp_oauth_grants_client" ON "mcp_oauth_grants" ("client_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mcp_oauth_grants_member" ON "mcp_oauth_grants" ("workspace_member_id")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mcp_oauth_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code_hash" varchar(64) NOT NULL,
        "client_id" uuid NOT NULL REFERENCES "mcp_oauth_clients" ("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
        "workspace_member_id" uuid NOT NULL REFERENCES "workspace_members" ("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "granted_role" varchar(16) NOT NULL,
        "scopes" jsonb NOT NULL,
        "redirect_uri" text NOT NULL,
        "code_challenge" varchar(64) NOT NULL,
        "resource" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz NULL,
        "grant_id" uuid NULL REFERENCES "mcp_oauth_grants" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mcp_oauth_codes_hash" UNIQUE ("code_hash")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mcp_oauth_codes_expires" ON "mcp_oauth_codes" ("expires_at")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mcp_oauth_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "grant_id" uuid NOT NULL REFERENCES "mcp_oauth_grants" ("id") ON DELETE CASCADE,
        "kind" varchar(16) NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "scopes" jsonb NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mcp_oauth_tokens_hash" UNIQUE ("token_hash"),
        CONSTRAINT "CHK_mcp_oauth_tokens_kind" CHECK ("kind" IN ('access', 'refresh'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mcp_oauth_tokens_grant" ON "mcp_oauth_tokens" ("grant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "mcp_oauth_tokens"');
    await queryRunner.query('DROP TABLE IF EXISTS "mcp_oauth_codes"');
    await queryRunner.query('DROP TABLE IF EXISTS "mcp_oauth_grants"');
    await queryRunner.query('DROP TABLE IF EXISTS "mcp_oauth_clients"');
  }
}
