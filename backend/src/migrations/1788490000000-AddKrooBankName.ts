import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKrooBankName1788490000000 implements MigrationInterface {
  name = 'AddKrooBankName1788490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'kroo\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'kroo' value will remain but is harmless if unused.
  }
}
