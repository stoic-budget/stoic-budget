import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMbankBankName1789560000000 implements MigrationInterface {
  name = 'AddMbankBankName1789560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'mbank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'mbank' value will remain but is harmless if unused.
  }
}
