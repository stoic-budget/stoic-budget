import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMetroBankBankName1788550000000 implements MigrationInterface {
  name = 'AddMetroBankBankName1788550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'metro_bank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'metro_bank' value will remain but is harmless if unused.
  }
}
