import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLloydsBankName1788510000000 implements MigrationInterface {
  name = 'AddLloydsBankName1788510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'lloyds\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'lloyds' value will remain but is harmless if unused.
  }
}
