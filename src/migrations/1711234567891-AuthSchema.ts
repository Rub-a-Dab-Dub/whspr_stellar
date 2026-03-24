import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSchema1711234567891 implements MigrationInterface {
  name = 'AuthSchema1711234567891';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Auth challenges (nonce per wallet, expires in 5 min)
    await queryRunner.query(`
      CREATE TABLE "auth_challenges" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "walletAddress" varchar(56) NOT NULL,
        "nonce" varchar(64) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Refresh tokens (single-use, hashed)
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "ipAddress" varchar(45),
        "userAgent" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_refresh_tokens_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Auth attempts (brute-force tracking)
    await queryRunner.query(`
      CREATE TABLE "auth_attempts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "walletAddress" varchar(56) NOT NULL,
        "ipAddress" varchar(45) NOT NULL,
        "success" boolean NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "idx_auth_challenges_wallet_address" ON "auth_challenges"("walletAddress")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_challenges_expires_at" ON "auth_challenges"("expiresAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens"("tokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens"("expiresAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_attempts_wallet_address" ON "auth_attempts"("walletAddress")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_attempts_ip_address" ON "auth_attempts"("ipAddress")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_attempts_created_at" ON "auth_attempts"("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_auth_attempts_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_auth_attempts_ip_address"`);
    await queryRunner.query(`DROP INDEX "idx_auth_attempts_wallet_address"`);
    await queryRunner.query(`DROP INDEX "idx_refresh_tokens_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_refresh_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX "idx_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_auth_challenges_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_auth_challenges_wallet_address"`);
    await queryRunner.query(`DROP TABLE "auth_attempts"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "auth_challenges"`);
  }
}
