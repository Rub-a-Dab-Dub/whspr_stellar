import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgTrgmExtension1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_wallet_trgm ON users USING gin (wallet_address gin_trgm_ops);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_wallet_trgm;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_username_trgm;`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm;`);
  }
}
