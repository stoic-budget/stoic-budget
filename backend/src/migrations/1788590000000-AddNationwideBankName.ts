import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNationwideBankName1788590000000 implements MigrationInterface {
  name = 'AddNationwideBankName1788590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'nationwide\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'nationwide' value will remain but is harmless if unused.
  }
}
