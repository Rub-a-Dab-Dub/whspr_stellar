import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeysSchema1760000000001 implements MigrationInterface {
  name = 'ApiKeysSchema1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "keyHash" varchar(64) NOT NULL,
        "prefix" varchar(24) NOT NULL,
        "label" varchar(120) NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]',
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "fk_api_keys_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_api_keys_user_id" ON "api_keys"("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_api_keys_key_hash" ON "api_keys"("keyHash")`);
    await queryRunner.query(`CREATE INDEX "idx_api_keys_prefix" ON "api_keys"("prefix")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_api_keys_prefix"`);
    await queryRunner.query(`DROP INDEX "idx_api_keys_key_hash"`);
    await queryRunner.query(`DROP INDEX "idx_api_keys_user_id"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}
