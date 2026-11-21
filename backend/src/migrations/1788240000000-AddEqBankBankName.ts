import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEqBankBankName1788240000000 implements MigrationInterface {
  name = 'AddEqBankBankName1788240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'eq_bank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'eq_bank' value will remain but is harmless if unused.
  }
}
