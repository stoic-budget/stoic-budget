import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKbcBankName1788470000000 implements MigrationInterface {
  name = 'AddKbcBankName1788470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'kbc\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'kbc' value will remain but is harmless if unused.
  }
}
