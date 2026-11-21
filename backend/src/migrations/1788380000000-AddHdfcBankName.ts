import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHdfcBankName1788380000000 implements MigrationInterface {
  name = 'AddHdfcBankName1788380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'hdfc\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'hdfc' value will remain but is harmless if unused.
  }
}
