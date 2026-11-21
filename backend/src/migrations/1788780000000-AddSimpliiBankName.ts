import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSimpliiBankName1788780000000 implements MigrationInterface {
  name = 'AddSimpliiBankName1788780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'simplii\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'simplii' value will remain but is harmless if unused.
  }
}
