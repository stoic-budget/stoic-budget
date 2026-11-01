import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCitiBankName1787810000000 implements MigrationInterface {
  name = 'AddCitiBankName1787810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'citi\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'citi' value will remain but is harmless if unused.
  }
}
