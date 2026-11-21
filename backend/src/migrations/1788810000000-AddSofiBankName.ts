import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSofiBankName1788810000000 implements MigrationInterface {
  name = 'AddSofiBankName1788810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'sofi\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'sofi' value will remain but is harmless if unused.
  }
}
