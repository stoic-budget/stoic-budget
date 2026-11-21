import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDesjardinsBankName1788210000000 implements MigrationInterface {
  name = 'AddDesjardinsBankName1788210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'desjardins\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'desjardins' value will remain but is harmless if unused.
  }
}
