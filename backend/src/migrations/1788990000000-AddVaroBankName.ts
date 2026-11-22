import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVaroBankName1788990000000 implements MigrationInterface {
  name = 'AddVaroBankName1788990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'varo\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'varo' value will remain but is harmless if unused.
  }
}
