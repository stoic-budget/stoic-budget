import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSogexiaBankName1788820000000 implements MigrationInterface {
  name = 'AddSogexiaBankName1788820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'sogexia\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'sogexia' value will remain but is harmless if unused.
  }
}
