import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBmoBankName1787700000000 implements MigrationInterface {
  name = 'AddBmoBankName1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'bendigo\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'bmo' value will remain but is harmless if unused.
  }
}
