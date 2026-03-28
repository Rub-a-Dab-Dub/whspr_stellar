import { MigrationInterface, QueryRunner } from 'typeorm';

export class SavedAddressesSchema1745100000000 implements MigrationInterface {
  name = 'SavedAddressesSchema1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_addresses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "walletAddress" varchar(56) NOT NULL,
        "alias" varchar(64) NOT NULL,
        "avatarUrl" text,
        "network" varchar(32) NOT NULL DEFAULT 'stellar_mainnet',
        "tags" text[] NOT NULL DEFAULT '{}',
        "lastUsedAt" TIMESTAMP,
        "usageCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_saved_addresses_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_saved_addresses_user_id" ON "saved_addresses"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_saved_addresses_wallet_address" ON "saved_addresses"("walletAddress")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_saved_addresses_last_used_at" ON "saved_addresses"("lastUsedAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_saved_addresses_user_alias_ci" ON "saved_addresses"("userId", LOWER("alias"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_saved_addresses_user_alias_ci"`);
    await queryRunner.query(`DROP INDEX "idx_saved_addresses_last_used_at"`);
    await queryRunner.query(`DROP INDEX "idx_saved_addresses_wallet_address"`);
    await queryRunner.query(`DROP INDEX "idx_saved_addresses_user_id"`);
    await queryRunner.query(`DROP TABLE "saved_addresses"`);
  }
}
