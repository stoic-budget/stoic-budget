import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaypalBankName1788660000000 implements MigrationInterface {
  name = 'AddPaypalBankName1788660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'paypal\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'paypal' value will remain but is harmless if unused.
  }
}
