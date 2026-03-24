import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711234567890 implements MigrationInterface {
  name = 'InitialSchema1711234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create user tier enum
    await queryRunner.query(`
      CREATE TYPE "user_tier_enum" AS ENUM ('free', 'premium', 'vip')
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "username" varchar(50) UNIQUE,
        "walletAddress" varchar(42) NOT NULL UNIQUE,
        "email" varchar(255) UNIQUE,
        "displayName" varchar(100),
        "avatarUrl" text,
        "bio" text,
        "tier" "user_tier_enum" NOT NULL DEFAULT 'free',
        "isActive" boolean NOT NULL DEFAULT true,
        "isVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "idx_users_username" ON "users"("username") WHERE "username" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "idx_users_wallet_address" ON "users"("walletAddress")`);
    await queryRunner.query(
      `CREATE INDEX "idx_users_email" ON "users"("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "idx_users_is_active" ON "users"("isActive")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_users_is_active"`);
    await queryRunner.query(`DROP INDEX "idx_users_email"`);
    await queryRunner.query(`DROP INDEX "idx_users_wallet_address"`);
    await queryRunner.query(`DROP INDEX "idx_users_username"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_tier_enum"`);
  }
}
