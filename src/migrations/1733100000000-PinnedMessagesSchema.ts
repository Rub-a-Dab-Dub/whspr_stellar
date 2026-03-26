import { MigrationInterface, QueryRunner } from 'typeorm';

export class PinnedMessagesSchema1733100000000 implements MigrationInterface {
  name = 'PinnedMessagesSchema1733100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD "chainGroupId" varchar(128)
    `);

    await queryRunner.query(`
      CREATE TABLE "pinned_messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "messageId" uuid NOT NULL,
        "pinnedBy" uuid NOT NULL,
        "pinnedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "note" varchar(500),
        "displayOrder" int NOT NULL DEFAULT 0,
        "snapshotContent" text NOT NULL,
        "snapshotType" "message_type_enum" NOT NULL DEFAULT 'text',
        "snapshotSenderId" uuid,
        "snapshotCreatedAt" TIMESTAMP NOT NULL,
        CONSTRAINT "fk_pinned_messages_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pinned_messages_pinned_by"
          FOREIGN KEY ("pinnedBy") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pinned_messages_snapshot_sender"
          FOREIGN KEY ("snapshotSenderId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "uq_pinned_messages_conversation_message" UNIQUE ("conversationId", "messageId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_pinned_messages_conversation_order"
      ON "pinned_messages"("conversationId", "displayOrder")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_pinned_messages_conversation_order"`);
    await queryRunner.query(`DROP TABLE "pinned_messages"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "chainGroupId"`);
  }
}
