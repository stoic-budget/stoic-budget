import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBpiBankName1787730000000 implements MigrationInterface {
  name = 'AddBpiBankName1787730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'bpi\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'bpi' value will remain but is harmless if unused.
  }
}
