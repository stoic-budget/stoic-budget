import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoOperativeBankBankName1788900000000 implements MigrationInterface {
  name = 'AddCoOperativeBankBankName1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'co_operative_bank\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'co_operative_bank' value will remain but is harmless if unused.
  }
}
