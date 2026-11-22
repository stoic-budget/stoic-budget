import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNcbaBankName1788620000000 implements MigrationInterface {
  name = 'AddNcbaBankName1788620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'ncba\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'ncba' value will remain but is harmless if unused.
  }
}
