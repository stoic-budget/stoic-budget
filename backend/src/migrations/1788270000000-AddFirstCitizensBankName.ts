import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirstCitizensBankName1788270000000 implements MigrationInterface {
  name = 'AddFirstCitizensBankName1788270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'first_citizens\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'first_citizens' value will remain but is harmless if unused.
  }
}
