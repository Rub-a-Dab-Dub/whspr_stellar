import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModerationAuditLogsTable1769700000000 implements MigrationInterface {
  name = 'CreateModerationAuditLogsTable1769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\
      CREATE TABLE "moderation_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "roomId" uuid NOT NULL,
        "messageId" uuid NOT NULL,
        "contentHash" varchar(64) NOT NULL,
        "reason" text NOT NULL,
        "moderatorId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moderation_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_moderation_audit_logs_message" FOREIGN KEY ("messageId") 
          REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_moderation_audit_logs_moderator" FOREIGN KEY ("moderatorId") 
          REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    \);

    await queryRunner.query(\
      CREATE INDEX "IDX_moderation_audit_logs_message" ON "moderation_audit_logs" ("messageId")
    \);

    await queryRunner.query(\
      CREATE INDEX "IDX_moderation_audit_logs_moderator" ON "moderation_audit_logs" ("moderatorId")
    \);

    await queryRunner.query(\
      CREATE INDEX "IDX_moderation_audit_logs_created_at" ON "moderation_audit_logs" ("createdAt")
    \);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\DROP INDEX IF EXISTS "IDX_moderation_audit_logs_created_at"\);
    await queryRunner.query(\DROP INDEX IF EXISTS "IDX_moderation_audit_logs_moderator"\);
    await queryRunner.query(\DROP INDEX IF EXISTS "IDX_moderation_audit_logs_message"\);
    await queryRunner.query(\DROP TABLE IF EXISTS "moderation_audit_logs"\);
  }
}
