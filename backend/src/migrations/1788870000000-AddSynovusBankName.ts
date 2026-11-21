import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSynovusBankName1788870000000 implements MigrationInterface {
  name = 'AddSynovusBankName1788870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'synovus\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'synovus' value will remain but is harmless if unused.
  }
}
