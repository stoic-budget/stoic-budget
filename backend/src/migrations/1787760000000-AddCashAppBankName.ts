import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashAppBankName1787760000000 implements MigrationInterface {
  name = 'AddCashAppBankName1787760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'cash_app\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'cash_app' value will remain but is harmless if unused.
  }
}
