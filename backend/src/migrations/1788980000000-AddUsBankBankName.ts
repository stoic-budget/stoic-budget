import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsBankBankName1788980000000 implements MigrationInterface {
  name = 'AddUsBankBankName1788980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'us_bank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'us_bank' value will remain but is harmless if unused.
  }
}
