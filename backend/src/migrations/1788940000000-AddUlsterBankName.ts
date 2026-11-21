import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUlsterBankName1788940000000 implements MigrationInterface {
  name = 'AddUlsterBankName1788940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'ulster\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'ulster' value will remain but is harmless if unused.
  }
}
