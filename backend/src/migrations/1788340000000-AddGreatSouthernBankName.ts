import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGreatSouthernBankName1788340000000 implements MigrationInterface {
  name = 'AddGreatSouthernBankName1788340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'great_southern\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'great_southern' value will remain but is harmless if unused.
  }
}
