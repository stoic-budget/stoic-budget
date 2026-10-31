import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBendigoBankName1787690000000 implements MigrationInterface {
  name = 'AddBendigoBankName1787690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'bendigo\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'bendigo' value will remain but is harmless if unused.
  }
}
