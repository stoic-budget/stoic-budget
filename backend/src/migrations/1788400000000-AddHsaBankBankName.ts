import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHsaBankBankName1788400000000 implements MigrationInterface {
  name = 'AddHsaBankBankName1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'hsa_bank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'hsa_bank' value will remain but is harmless if unused.
  }
}
