import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStarlingBankName1788840000000 implements MigrationInterface {
  name = 'AddStarlingBankName1788840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'starling\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'starling' value will remain but is harmless if unused.
  }
}
