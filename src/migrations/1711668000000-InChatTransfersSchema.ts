import { MigrationInterface, QueryRunner } from 'typeorm';

export class InChatTransfersSchema1711668000000 implements MigrationInterface {
  name = 'InChatTransfersSchema1711668000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "conversation_type_enum" AS ENUM ('direct', 'group')
    `);
    await queryRunner.query(`
      CREATE TYPE "message_type_enum" AS ENUM ('text', 'transfer', 'system')
    `);
    await queryRunner.query(`
      CREATE TYPE "transaction_status_enum" AS ENUM ('submitted', 'completed', 'failed')
    `);
    await queryRunner.query(`
      CREATE TYPE "transfer_status_enum" AS ENUM (
        'pending_confirmation',
        'confirmed',
        'submitted',
        'completed',
        'failed'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "transfer_command_type_enum" AS ENUM ('send', 'tip', 'split')
    `);

    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" "conversation_type_enum" NOT NULL DEFAULT 'direct',
        "title" varchar(120),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "conversation_participants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_conversation_participants_conversation_user"
          UNIQUE ("conversationId", "userId"),
        CONSTRAINT "fk_conversation_participants_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_conversation_participants_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_conversation_participants_conversation_id"
      ON "conversation_participants"("conversationId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_conversation_participants_user_id"
      ON "conversation_participants"("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "senderId" uuid,
        "type" "message_type_enum" NOT NULL DEFAULT 'text',
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_messages_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_messages_sender"
          FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_messages_conversation_id" ON "messages"("conversationId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_messages_sender_id" ON "messages"("senderId")
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "senderId" uuid NOT NULL,
        "asset" varchar(16) NOT NULL,
        "totalAmount" numeric(20,7) NOT NULL,
        "status" "transaction_status_enum" NOT NULL DEFAULT 'submitted',
        "txHash" varchar(128),
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_transactions_sender"
          FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_transactions_sender_id" ON "transactions"("senderId")
    `);

    await queryRunner.query(`
      CREATE TABLE "in_chat_transfers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "recipientIds" text NOT NULL,
        "recipientUsernames" text NOT NULL,
        "commandType" "transfer_command_type_enum" NOT NULL,
        "rawCommand" text NOT NULL,
        "totalAmount" numeric(20,7) NOT NULL,
        "amountPerRecipient" numeric(20,7) NOT NULL,
        "asset" varchar(16) NOT NULL,
        "status" "transfer_status_enum" NOT NULL DEFAULT 'pending_confirmation',
        "feeEstimate" numeric(20,7) NOT NULL,
        "errorMessage" text,
        "sorobanTxHash" varchar(128),
        "messageId" uuid,
        "transactionId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_in_chat_transfers_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_in_chat_transfers_sender"
          FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_in_chat_transfers_message"
          FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_in_chat_transfers_transaction"
          FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_in_chat_transfers_conversation_id"
      ON "in_chat_transfers"("conversationId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_in_chat_transfers_sender_id"
      ON "in_chat_transfers"("senderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_in_chat_transfers_sender_id"`);
    await queryRunner.query(`DROP INDEX "idx_in_chat_transfers_conversation_id"`);
    await queryRunner.query(`DROP TABLE "in_chat_transfers"`);

    await queryRunner.query(`DROP INDEX "idx_transactions_sender_id"`);
    await queryRunner.query(`DROP TABLE "transactions"`);

    await queryRunner.query(`DROP INDEX "idx_messages_sender_id"`);
    await queryRunner.query(`DROP INDEX "idx_messages_conversation_id"`);
    await queryRunner.query(`DROP TABLE "messages"`);

    await queryRunner.query(`DROP INDEX "idx_conversation_participants_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_conversation_participants_conversation_id"`);
    await queryRunner.query(`DROP TABLE "conversation_participants"`);

    await queryRunner.query(`DROP TABLE "conversations"`);

    await queryRunner.query(`DROP TYPE "transfer_command_type_enum"`);
    await queryRunner.query(`DROP TYPE "transfer_status_enum"`);
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE "message_type_enum"`);
    await queryRunner.query(`DROP TYPE "conversation_type_enum"`);
  }
}
