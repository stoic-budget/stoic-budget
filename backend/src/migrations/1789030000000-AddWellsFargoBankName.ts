import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWellsFargoBankName1789030000000 implements MigrationInterface {
  name = 'AddWellsFargoBankName1789030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'wells_fargo\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'wells_fargo' value will remain but is harmless if unused.
  }
}
