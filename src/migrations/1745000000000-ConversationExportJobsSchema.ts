import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConversationExportJobsSchema1745000000000 implements MigrationInterface {
  name = 'ConversationExportJobsSchema1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversation_export_jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "conversationId" uuid NOT NULL,
        "format" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING',
        "fileUrl" text,
        "fileKey" varchar(512),
        "fileSize" bigint,
        "requestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_conversation_export_jobs_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_conversation_export_jobs_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_conversation_export_jobs_user_id" ON "conversation_export_jobs"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_export_jobs_conversation_id" ON "conversation_export_jobs"("conversationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_export_jobs_status" ON "conversation_export_jobs"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_export_jobs_requested_at" ON "conversation_export_jobs"("requestedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_conversation_export_jobs_requested_at"`);
    await queryRunner.query(`DROP INDEX "idx_conversation_export_jobs_status"`);
    await queryRunner.query(`DROP INDEX "idx_conversation_export_jobs_conversation_id"`);
    await queryRunner.query(`DROP INDEX "idx_conversation_export_jobs_user_id"`);
    await queryRunner.query(`DROP TABLE "conversation_export_jobs"`);
  }
}
