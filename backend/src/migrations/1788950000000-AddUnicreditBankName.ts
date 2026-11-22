import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnicreditBankName1788950000000 implements MigrationInterface {
  name = 'AddUnicreditBankName1788950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'unicredit\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'unicredit' value will remain but is harmless if unused.
  }
}
