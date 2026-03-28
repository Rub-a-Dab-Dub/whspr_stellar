import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageDraftsSchema1743300000000 implements MigrationInterface {
  name = 'MessageDraftsSchema1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "message_drafts" (
        "id"             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"         uuid        NOT NULL,
        "conversationId" uuid        NOT NULL,
        "content"        text        NOT NULL,
        "attachmentIds"  text,
        "replyToId"      uuid,
        "updatedAt"      TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "uq_message_drafts_user_conversation"
          UNIQUE ("userId", "conversationId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_message_drafts_user_id"
      ON "message_drafts"("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_message_drafts_conversation_id"
      ON "message_drafts"("conversationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_message_drafts_conversation_id"`);
    await queryRunner.query(`DROP INDEX "idx_message_drafts_user_id"`);
    await queryRunner.query(`DROP TABLE "message_drafts"`);
  }
}
