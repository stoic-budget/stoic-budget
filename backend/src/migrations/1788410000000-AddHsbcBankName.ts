import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHsbcBankName1788410000000 implements MigrationInterface {
  name = 'AddHsbcBankName1788410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'hsbc\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'hsbc' value will remain but is harmless if unused.
  }
}
