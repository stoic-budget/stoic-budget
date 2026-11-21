import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOptumBankName1788640000000 implements MigrationInterface {
  name = 'AddOptumBankName1788640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'optum\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'optum' value will remain but is harmless if unused.
  }
}
