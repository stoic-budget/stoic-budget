import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegionsBankName1788720000000 implements MigrationInterface {
  name = 'AddRegionsBankName1788720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'regions\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'regions' value will remain but is harmless if unused.
  }
}
