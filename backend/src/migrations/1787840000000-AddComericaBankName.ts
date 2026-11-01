import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComericaBankName1787840000000 implements MigrationInterface {
  name = 'AddComericaBankName1787840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'comerica\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'comerica' value will remain but is harmless if unused.
  }
}
