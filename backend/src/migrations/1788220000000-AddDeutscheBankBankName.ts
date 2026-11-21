import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeutscheBankBankName1788220000000 implements MigrationInterface {
  name = 'AddDeutscheBankBankName1788220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'deutsche_bank\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'deutsche_bank' value will remain but is harmless if unused.
  }
}
