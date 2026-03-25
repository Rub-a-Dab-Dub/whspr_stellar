import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserLocaleSchema1711234567894 implements MigrationInterface {
  name = 'UserLocaleSchema1711234567894';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "preferredLocale" varchar(10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "preferredLocale"
    `);
  }
}
