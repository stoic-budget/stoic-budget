import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditOneBankName1787890000000 implements MigrationInterface {
  name = 'AddCreditOneBankName1787890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'credit_one\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'credit_one' value will remain but is harmless if unused.
  }
}
