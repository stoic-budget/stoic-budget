import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChaseBankName1787780000000 implements MigrationInterface {
  name = 'AddChaseBankName1787780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'chase\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'chase' value will remain but is harmless if unused.
  }
}
