import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIbcBankName1788430000000 implements MigrationInterface {
  name = 'AddIbcBankName1788430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'ibc\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'ibc' value will remain but is harmless if unused.
  }
}
