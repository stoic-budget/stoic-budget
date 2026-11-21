import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNatwestBankName1788600000000 implements MigrationInterface {
  name = 'AddNatwestBankName1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'natwest\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'natwest' value will remain but is harmless if unused.
  }
}
