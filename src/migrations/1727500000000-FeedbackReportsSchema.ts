import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackReportsSchema1727500000000 implements MigrationInterface {
  name = 'FeedbackReportsSchema1727500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "feedback_type" AS ENUM('BUG', 'FEEDBACK', 'FEATURE_REQUEST');
      CREATE TYPE "feedback_status" AS ENUM('NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
      CREATE TYPE "feedback_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH');
    `);

    await queryRunner.query(`
      CREATE TABLE "feedback_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid,
        "type" "feedback_type" DEFAULT 'FEEDBACK' NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "screenshotUrl" varchar(2048),
        "appVersion" varchar(50),
        "platform" varchar(50),
        "deviceInfo" jsonb,
        "status" "feedback_status" DEFAULT 'NEW' NOT NULL,
        "priority" "feedback_priority" DEFAULT 'MEDIUM' NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_feedback_type_status" ON "feedback_reports" ("type", "status");
      CREATE INDEX "idx_feedback_status_priority_created" ON "feedback_reports" ("status", "priority", "createdAt");
      CREATE INDEX "idx_feedback_userId" ON "feedback_reports" ("userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_feedback_userId"`);
    await queryRunner.query(`DROP INDEX "idx_feedback_status_priority_created"`);
    await queryRunner.query(`DROP INDEX "idx_feedback_type_status"`);
    await queryRunner.query(`DROP TABLE "feedback_reports"`);
    await queryRunner.query(`DROP TYPE "feedback_priority"`);
    await queryRunner.query(`DROP TYPE "feedback_status"`);
    await queryRunner.query(`DROP TYPE "feedback_type"`);
  }
}
