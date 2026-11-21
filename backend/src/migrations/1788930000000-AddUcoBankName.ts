import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUcoBankName1788930000000 implements MigrationInterface {
  name = 'AddUcoBankName1788930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'uco\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'uco' value will remain but is harmless if unused.
  }
}
