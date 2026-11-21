import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayoneerBankName1788650000000 implements MigrationInterface {
  name = 'AddPayoneerBankName1788650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'payoneer\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'payoneer' value will remain but is harmless if unused.
  }
}
