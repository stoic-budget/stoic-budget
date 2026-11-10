import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Daily closes of the symbols people hold, in two places:
 * - `security_prices` and `security_price_symbols`: the feed's closes and how
 *   the feed is doing per symbol. Market data, shared by every workspace that
 *   holds the symbol, with no workspace column: nothing a workspace enters
 *   lands here.
 * - `workspace_security_prices`: closes a workspace typed in or imported. They
 *   win over the feed's close of the same day in that workspace only, and go
 *   with the workspace when it is deleted.
 * Nothing is backfilled here: the daily job and the first read of a symbol
 * fetch its history.
 */
export class AddSecurityPrices1788300000000 implements MigrationInterface {
  name = 'AddSecurityPrices1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "security_prices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbol" character varying(32) NOT NULL,
        "price_date" date NOT NULL,
        "close" numeric(20,8) NOT NULL,
        "currency" character varying(10) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_security_prices" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_security_prices_close" CHECK ("close" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_security_prices_symbol_date"
      ON "security_prices" ("symbol", "price_date")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "security_price_symbols" (
        "symbol" character varying(32) NOT NULL,
        "currency" character varying(10),
        "consecutive_failures" integer NOT NULL DEFAULT 0,
        "last_close_on" date,
        "last_attempt_at" TIMESTAMP WITH TIME ZONE,
        "backfilled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_security_price_symbols" PRIMARY KEY ("symbol"),
        CONSTRAINT "CHK_security_price_symbols_failures" CHECK ("consecutive_failures" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_security_prices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "symbol" character varying(32) NOT NULL,
        "price_date" date NOT NULL,
        "close" numeric(20,8) NOT NULL,
        "currency" character varying(10) NOT NULL,
        "source" character varying(10) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_security_prices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_security_prices_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_workspace_security_prices_close" CHECK ("close" > 0),
        CONSTRAINT "CHK_workspace_security_prices_source" CHECK ("source" IN ('manual', 'import'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_workspace_security_prices_symbol_date"
      ON "workspace_security_prices" ("workspace_id", "symbol", "price_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_workspace_security_prices_symbol_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_security_prices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_price_symbols"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_security_prices_symbol_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_prices"`);
  }
}
