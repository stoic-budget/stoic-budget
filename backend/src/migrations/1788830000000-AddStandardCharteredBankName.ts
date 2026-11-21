import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStandardCharteredBankName1788830000000 implements MigrationInterface {
  name = 'AddStandardCharteredBankName1788830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'standard_chartered\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'standard_chartered' value will remain but is harmless if unused.
  }
}
