import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIciciBankName1788440000000 implements MigrationInterface {
  name = 'AddIciciBankName1788440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'icici\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'icici' value will remain but is harmless if unused.
  }
}
