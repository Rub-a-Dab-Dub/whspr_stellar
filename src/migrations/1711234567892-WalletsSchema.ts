import { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletsSchema1711234567892 implements MigrationInterface {
  name = 'WalletsSchema1711234567892';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "wallet_network_enum" AS ENUM ('stellar_mainnet', 'stellar_testnet')
    `);

    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"        uuid NOT NULL,
        "walletAddress" varchar(56) NOT NULL,
        "network"       "wallet_network_enum" NOT NULL DEFAULT 'stellar_mainnet',
        "isVerified"    boolean NOT NULL DEFAULT false,
        "isPrimary"     boolean NOT NULL DEFAULT false,
        "label"         varchar(100),
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_wallets_user_address" UNIQUE ("userId", "walletAddress"),
        CONSTRAINT "fk_wallets_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_wallets_user_id"   ON "wallets"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wallets_address"   ON "wallets"("walletAddress")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wallets_is_primary" ON "wallets"("isPrimary")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_wallets_is_primary"`);
    await queryRunner.query(`DROP INDEX "idx_wallets_address"`);
    await queryRunner.query(`DROP INDEX "idx_wallets_user_id"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TYPE "wallet_network_enum"`);
  }
}
