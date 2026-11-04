import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBoqBankName1787720000000 implements MigrationInterface {
  name = 'AddBoqBankName1787720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'boq\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'boq' value will remain but is harmless if unused.
  }
}
