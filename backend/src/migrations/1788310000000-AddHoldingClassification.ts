import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where a holding's money sits: a sector, a region and a country, typed in by
 * hand, and for a fund a breakdown by weights (`look_through`). All of it is
 * optional and nothing is backfilled: a holding nobody classified counts as
 * unclassified on the allocation, which is the truth.
 *
 * The lists of sectors and regions live in the API contracts, so the columns
 * are plain text; the CHECKs only keep out shapes no code would write.
 */
export class AddHoldingClassification1788310000000 implements MigrationInterface {
  name = 'AddHoldingClassification1788310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        ADD COLUMN IF NOT EXISTS "sector" character varying(40),
        ADD COLUMN IF NOT EXISTS "region" character varying(40),
        ADD COLUMN IF NOT EXISTS "country" character varying(2),
        ADD COLUMN IF NOT EXISTS "look_through" jsonb
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "investment_holdings" ADD CONSTRAINT "CHK_investment_holdings_country"
          CHECK ("country" IS NULL OR "country" ~ '^[A-Z]{2}$');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "investment_holdings" ADD CONSTRAINT "CHK_investment_holdings_look_through"
          CHECK ("look_through" IS NULL OR jsonb_typeof("look_through") = 'object');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "investment_holdings" DROP CONSTRAINT IF EXISTS "CHK_investment_holdings_look_through"`,
    );
    await queryRunner.query(
      `ALTER TABLE "investment_holdings" DROP CONSTRAINT IF EXISTS "CHK_investment_holdings_country"`,
    );
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        DROP COLUMN IF EXISTS "look_through",
        DROP COLUMN IF EXISTS "country",
        DROP COLUMN IF EXISTS "region",
        DROP COLUMN IF EXISTS "sector"
    `);
  }
}
