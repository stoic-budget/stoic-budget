import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trades behind a holding: buys, sells, dividends, splits and transfers. A
 * holding with trades takes its quantity from them; one without keeps the
 * quantity typed into it, so nothing existing changes and nothing is backfilled.
 *
 * The CHECKs say which fields each kind uses, so a row the lot engine cannot
 * read never lands: a dividend has a cash amount and no units, a split a ratio
 * and nothing else, everything else a positive quantity.
 */
export class AddInvestmentTrades1788290000000 implements MigrationInterface {
  name = 'AddInvestmentTrades1788290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "investment_trade_kind_enum" AS ENUM
          ('buy', 'sell', 'dividend', 'split', 'transfer_in', 'transfer_out');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investment_trades" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "holding_id" uuid NOT NULL,
        "kind" "investment_trade_kind_enum" NOT NULL,
        "trade_date" date NOT NULL,
        "quantity" numeric(24,8) NOT NULL DEFAULT 0,
        "price" numeric(20,8) NOT NULL DEFAULT 0,
        "fee" numeric(20,6) NOT NULL DEFAULT 0,
        "amount" numeric(20,6),
        "currency" character varying(10) NOT NULL,
        "split_from" numeric(20,8),
        "split_to" numeric(20,8),
        "acquired_on" date,
        "transaction_id" uuid,
        "note" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_investment_trades" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_trades_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_investment_trades_holding"
          FOREIGN KEY ("holding_id") REFERENCES "investment_holdings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_investment_trades_transaction"
          FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_investment_trades_non_negative" CHECK (
          "quantity" >= 0 AND "price" >= 0 AND "fee" >= 0 AND ("amount" IS NULL OR "amount" >= 0)
        ),
        CONSTRAINT "CHK_investment_trades_currency" CHECK (char_length("currency") BETWEEN 3 AND 10),
        CONSTRAINT "CHK_investment_trades_units" CHECK (
          "kind" NOT IN ('buy', 'sell', 'transfer_in', 'transfer_out')
          OR ("quantity" > 0 AND "amount" IS NULL AND "split_from" IS NULL AND "split_to" IS NULL)
        ),
        CONSTRAINT "CHK_investment_trades_dividend" CHECK (
          "kind" <> 'dividend'
          OR ("amount" IS NOT NULL AND "quantity" = 0 AND "price" = 0
              AND "split_from" IS NULL AND "split_to" IS NULL)
        ),
        CONSTRAINT "CHK_investment_trades_split" CHECK (
          "kind" <> 'split'
          OR ("split_from" > 0 AND "split_to" > 0 AND "quantity" = 0 AND "price" = 0
              AND "fee" = 0 AND "amount" IS NULL)
        ),
        CONSTRAINT "CHK_investment_trades_acquired_on" CHECK (
          "acquired_on" IS NULL OR "kind" = 'transfer_in'
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_trades_workspace_holding_date"
      ON "investment_trades" ("workspace_id", "holding_id", "trade_date")
    `);
    // The cascade from a deleted holding and the SET NULL from a deleted row look these up.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_trades_holding"
      ON "investment_trades" ("holding_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_trades_transaction"
      ON "investment_trades" ("transaction_id") WHERE "transaction_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_investment_trades_transaction"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_investment_trades_holding"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_investment_trades_workspace_holding_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_trades"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "investment_trade_kind_enum"`);
  }
}
