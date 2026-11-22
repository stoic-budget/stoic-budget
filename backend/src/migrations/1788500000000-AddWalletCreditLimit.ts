import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A credit card's limit, in the account's currency. Nullable: accounts made
 * before this, and every account that is not a card, have none. The check
 * keeps it that way when two writes race (a type change and a new limit).
 */
export class AddWalletCreditLimit1788500000000 implements MigrationInterface {
  name = 'AddWalletCreditLimit1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(15,2)',
    );
    await queryRunner.query(
      'ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "CHK_wallets_credit_limit_card_only"',
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "CHK_wallets_credit_limit_card_only" CHECK ("type" = 'credit_card' OR "credit_limit" IS NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "CHK_wallets_credit_limit_card_only"',
    );
    await queryRunner.query('ALTER TABLE "wallets" DROP COLUMN IF EXISTS "credit_limit"');
  }
}
