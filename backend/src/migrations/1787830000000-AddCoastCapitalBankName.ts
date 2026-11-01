import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoastCapitalBankName1787830000000 implements MigrationInterface {
  name = 'AddCoastCapitalBankName1787830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'coast_capital\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'coast_capital' value will remain but is harmless if unused.
  }
}
