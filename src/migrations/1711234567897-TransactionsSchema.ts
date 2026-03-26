import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionsSchema1711234567897 implements MigrationInterface {
  name = 'TransactionsSchema1711234567897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "transaction_status_enum" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TYPE "transaction_type_enum" AS ENUM ('TRANSFER', 'TIP', 'SPLIT', 'TREASURY')
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "txHash" varchar(128) NOT NULL UNIQUE,
        "fromAddress" varchar(128) NOT NULL,
        "toAddress" varchar(128) NOT NULL,
        "tokenId" varchar(128) NOT NULL,
        "amount" numeric(38, 18) NOT NULL DEFAULT 0,
        "fee" numeric(38, 18) NOT NULL DEFAULT 0,
        "status" "transaction_status_enum" NOT NULL DEFAULT 'PENDING',
        "type" "transaction_type_enum" NOT NULL,
        "conversationId" uuid,
        "messageId" uuid,
        "network" varchar(64) NOT NULL,
        "ledger" varchar(64),
        "failureReason" text,
        "confirmedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_transactions_tx_hash" ON "transactions"("txHash")`);
    await queryRunner.query(`CREATE INDEX "idx_transactions_from_address" ON "transactions"("fromAddress")`);
    await queryRunner.query(`CREATE INDEX "idx_transactions_to_address" ON "transactions"("toAddress")`);
    await queryRunner.query(`CREATE INDEX "idx_transactions_token_id" ON "transactions"("tokenId")`);
    await queryRunner.query(`CREATE INDEX "idx_transactions_status" ON "transactions"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_transactions_type" ON "transactions"("type")`);
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_conversation_id" ON "transactions"("conversationId")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_transactions_message_id" ON "transactions"("messageId")`);
    await queryRunner.query(`CREATE INDEX "idx_transactions_network" ON "transactions"("network")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_transactions_network"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_message_id"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_conversation_id"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_type"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_status"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_token_id"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_to_address"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_from_address"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_tx_hash"`);

    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
  }
}
