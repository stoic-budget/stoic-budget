import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDcuBankName1787900000000 implements MigrationInterface {
  name = 'AddDcuBankName1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'dcu\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'dcu' value will remain but is harmless if unused.
  }
}
