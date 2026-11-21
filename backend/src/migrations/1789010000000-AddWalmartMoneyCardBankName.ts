import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalmartMoneyCardBankName1789010000000 implements MigrationInterface {
  name = 'AddWalmartMoneyCardBankName1789010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'walmart_moneycard\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'walmart_moneycard' value will remain but is harmless if unused.
  }
}
