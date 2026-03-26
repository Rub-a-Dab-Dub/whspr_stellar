import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchSchema1711234567893 implements MigrationInterface {
  name = 'SearchSchema1711234567893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Create groups table ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id"          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"        varchar(100) NOT NULL UNIQUE,
        "description" text,
        "isPublic"    boolean     NOT NULL DEFAULT true,
        "ownerId"     uuid,
        "searchVector" tsvector,
        "createdAt"   TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_groups_name"     ON "groups"("name")`);
    await queryRunner.query(`CREATE INDEX "idx_groups_owner_id" ON "groups"("ownerId")`);

    // ── Create messages table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"           uuid      PRIMARY KEY DEFAULT uuid_generate_v4(),
        "content"      text      NOT NULL,
        "groupId"      uuid,
        "senderId"     uuid,
        "searchVector" tsvector,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_messages_group_id"   ON "messages"("groupId")`);
    await queryRunner.query(`CREATE INDEX "idx_messages_sender_id"  ON "messages"("senderId")`);
    await queryRunner.query(`CREATE INDEX "idx_messages_created_at" ON "messages"("createdAt")`);

    // ── Create tokens table ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "id"              uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
        "symbol"          varchar(20)  NOT NULL,
        "name"            varchar(100) NOT NULL,
        "contractAddress" varchar(100),
        "network"         varchar(50),
        "isActive"        boolean      NOT NULL DEFAULT true,
        "searchVector"    tsvector,
        "createdAt"       TIMESTAMP    NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP    NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_tokens_symbol" ON "tokens"("symbol")`);

    // ── Add searchVector to users table ─────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "searchVector" tsvector
    `);

    // ── GIN indexes for full-text search ────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX "idx_users_search_vector"    ON "users"    USING GIN("searchVector")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_groups_search_vector"   ON "groups"   USING GIN("searchVector")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_messages_search_vector" ON "messages" USING GIN("searchVector")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tokens_search_vector"   ON "tokens"   USING GIN("searchVector")`,
    );

    // ── Trigger functions to keep searchVector up-to-date ───────────────────

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION users_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" := to_tsvector('english',
          COALESCE(NEW.username, '') || ' ' ||
          COALESCE(NEW."displayName", '') || ' ' ||
          COALESCE(NEW.bio, '')
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER users_search_vector_trigger
        BEFORE INSERT OR UPDATE ON "users"
        FOR EACH ROW EXECUTE FUNCTION users_search_vector_update();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION groups_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" := to_tsvector('english',
          COALESCE(NEW.name, '') || ' ' ||
          COALESCE(NEW.description, '')
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER groups_search_vector_trigger
        BEFORE INSERT OR UPDATE ON "groups"
        FOR EACH ROW EXECUTE FUNCTION groups_search_vector_update();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" := to_tsvector('english', COALESCE(NEW.content, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER messages_search_vector_trigger
        BEFORE INSERT OR UPDATE ON "messages"
        FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION tokens_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" := to_tsvector('english',
          COALESCE(NEW.symbol, '') || ' ' ||
          COALESCE(NEW.name, '') || ' ' ||
          COALESCE(NEW."contractAddress", '')
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER tokens_search_vector_trigger
        BEFORE INSERT OR UPDATE ON "tokens"
        FOR EACH ROW EXECUTE FUNCTION tokens_search_vector_update();
    `);

    // ── Backfill existing users ──────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "users"
      SET "searchVector" = to_tsvector('english',
        COALESCE(username, '') || ' ' ||
        COALESCE("displayName", '') || ' ' ||
        COALESCE(bio, '')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS tokens_search_vector_trigger   ON "tokens"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS messages_search_vector_trigger ON "messages"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS groups_search_vector_trigger   ON "groups"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS users_search_vector_trigger    ON "users"`);

    // Drop trigger functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS tokens_search_vector_update()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS messages_search_vector_update()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS groups_search_vector_update()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS users_search_vector_update()`);

    // Drop GIN indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tokens_search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_groups_search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_search_vector"`);

    // Remove searchVector from users
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "searchVector"`);

    // Drop tables
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tokens_symbol"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tokens"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_sender_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_group_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_groups_owner_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_groups_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups"`);
  }
}
