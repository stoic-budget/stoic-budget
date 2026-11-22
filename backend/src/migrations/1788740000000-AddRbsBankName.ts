import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRbsBankName1788740000000 implements MigrationInterface {
  name = 'AddRbsBankName1788740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'rbs\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'rbs' value will remain but is harmless if unused.
  }
}
