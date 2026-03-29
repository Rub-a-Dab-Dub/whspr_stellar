import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractStateCacheSchema1783000000000 implements MigrationInterface {
  name = 'ContractStateCacheSchema1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "contract_state_key_type_enum" AS ENUM (
          'USER_REGISTRY',
          'GROUP_MEMBERSHIP',
          'TOKEN_BALANCE',
          'KEY_RECORD'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_state_cache" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contract_address" varchar(64) NOT NULL,
        "state_key" varchar(512) NOT NULL,
        "key_type" "contract_state_key_type_enum" NOT NULL,
        "state_value" jsonb NOT NULL,
        "ledger" bigint NOT NULL,
        "cached_at" TIMESTAMPTZ NOT NULL,
        "ttl_seconds" int NOT NULL DEFAULT 300,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_contract_state_cache_contract_key"
          UNIQUE ("contract_address", "state_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_contract_state_cache_contract"
      ON "contract_state_cache" ("contract_address")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_contract_state_cache_key_type"
      ON "contract_state_cache" ("contract_address", "key_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_state_cache"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contract_state_key_type_enum"`);
  }
}
