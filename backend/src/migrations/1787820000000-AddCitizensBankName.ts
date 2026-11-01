import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCitizensBankName1787820000000 implements MigrationInterface {
  name = 'AddCitizensBankName1787820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'citizens\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'citizens' value will remain but is harmless if unused.
  }
}
