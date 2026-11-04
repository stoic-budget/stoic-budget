import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommerceBankBankName1787860000000 implements MigrationInterface {
  name = 'AddCommerceBankBankName1787860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'commerce_bank\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'commerce_bank' value will remain but is harmless if unused.
  }
}
