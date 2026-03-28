import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Adds support tables for roles, feature flags, sticker packs,
 * and contact import functionality.
 */
export class CoreSupportTables1774800000000 implements MigrationInterface {
  name = 'CoreSupportTables1774800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Roles Table ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(50) NOT NULL UNIQUE,
        "description" text,
        "permissions" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_roles_name" ON "roles"("name")
    `);

    // ── Feature Flags Table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_flags" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "enabled" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_feature_flags_name" ON "feature_flags"("name")
    `);

    // ── Sticker Packs Table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sticker_packs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "stickerUrls" jsonb NOT NULL DEFAULT '[]',
        "isPremium" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sticker_packs_name" ON "sticker_packs"("name")
    `);

    // ── Contact Import Session Table ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contact_import_sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL UNIQUE,
        "hashes" jsonb NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_contact_import_sessions_owner"
          FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_contact_import_sessions_owner_id" 
      ON "contact_import_sessions"("ownerId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_contact_import_sessions_expires_at" 
      ON "contact_import_sessions"("expiresAt")
    `);

    // ── User Contact Hash Index Table ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "contact_hash_type_enum" AS ENUM ('PHONE', 'EMAIL')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_contact_hash_index" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "contact_hash_type_enum" NOT NULL,
        "hash" varchar(64) NOT NULL,
        "username" varchar(50),
        "displayName" varchar(100),
        "avatarUrl" text,
        CONSTRAINT "uq_user_contact_hash_index_user_type_hash" 
          UNIQUE ("userId", "type", "hash")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_contact_hash_index_hash_type" 
      ON "user_contact_hash_index"("hash", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_contact_hash_index_user_id" 
      ON "user_contact_hash_index"("userId")
    `);

    // ── Add foreign key constraint to user_badges if not exists ───────────
    // Check if constraint exists before adding
    const fkExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_user_badges_user'
    `);

    if (!fkExists.length) {
      await queryRunner.query(`
        ALTER TABLE "user_badges"
        ADD CONSTRAINT "fk_user_badges_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop contact hash index table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_contact_hash_index_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_contact_hash_index_hash_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_contact_hash_index"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contact_hash_type_enum"`);

    // Drop contact import session table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_import_sessions_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_import_sessions_owner_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_import_sessions"`);

    // Drop sticker packs table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sticker_packs_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sticker_packs"`);

    // Drop feature flags table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_feature_flags_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_flags"`);

    // Drop roles table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_roles_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }
}
