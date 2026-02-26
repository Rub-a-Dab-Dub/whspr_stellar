import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSearchFields1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS is_online;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS level;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;`);
  }
}
