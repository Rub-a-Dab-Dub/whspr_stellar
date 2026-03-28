import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeveloperSandboxSchema1745300000000 implements MigrationInterface {
  name = 'DeveloperSandboxSchema1745300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "sandbox_transaction_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TYPE "sandbox_transaction_type_enum" AS ENUM ('FRIEND_BOT_FUND', 'SANDBOX_TRANSFER')
    `);

    await queryRunner.query(`
      CREATE TABLE "sandbox_environments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL UNIQUE,
        "apiKeyId" varchar(128) NOT NULL UNIQUE,
        "testWallets" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_sandbox_environments_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_sandbox_environments_user_id" ON "sandbox_environments"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sandbox_environments_api_key_id" ON "sandbox_environments"("apiKeyId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "sandbox_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "environmentId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "walletAddress" varchar(56) NOT NULL,
        "asset" varchar(16) NOT NULL DEFAULT 'XLM',
        "amount" numeric(20,7) NOT NULL DEFAULT 0,
        "network" varchar(64) NOT NULL DEFAULT 'stellar_testnet',
        "friendbotTxHash" varchar(128),
        "type" "sandbox_transaction_type_enum" NOT NULL DEFAULT 'FRIEND_BOT_FUND',
        "status" "sandbox_transaction_status_enum" NOT NULL DEFAULT 'PENDING',
        "isSandbox" boolean NOT NULL DEFAULT true,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_sandbox_transactions_environment"
          FOREIGN KEY ("environmentId") REFERENCES "sandbox_environments"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sandbox_transactions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_sandbox_transactions_environment_id" ON "sandbox_transactions"("environmentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sandbox_transactions_user_id" ON "sandbox_transactions"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sandbox_transactions_wallet_address" ON "sandbox_transactions"("walletAddress")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sandbox_transactions_is_sandbox" ON "sandbox_transactions"("isSandbox")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_sandbox_transactions_is_sandbox"`);
    await queryRunner.query(`DROP INDEX "idx_sandbox_transactions_wallet_address"`);
    await queryRunner.query(`DROP INDEX "idx_sandbox_transactions_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_sandbox_transactions_environment_id"`);
    await queryRunner.query(`DROP TABLE "sandbox_transactions"`);

    await queryRunner.query(`DROP INDEX "idx_sandbox_environments_api_key_id"`);
    await queryRunner.query(`DROP INDEX "idx_sandbox_environments_user_id"`);
    await queryRunner.query(`DROP TABLE "sandbox_environments"`);

    await queryRunner.query(`DROP TYPE "sandbox_transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE "sandbox_transaction_status_enum"`);
  }
}
