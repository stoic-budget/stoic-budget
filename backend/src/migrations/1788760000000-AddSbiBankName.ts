import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSbiBankName1788760000000 implements MigrationInterface {
  name = 'AddSbiBankName1788760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'sbi\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'sbi' value will remain but is harmless if unused.
  }
}
