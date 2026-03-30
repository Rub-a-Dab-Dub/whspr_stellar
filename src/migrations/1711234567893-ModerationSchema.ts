import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModerationSchema1711234567893 implements MigrationInterface {
  name = 'ModerationSchema1711234567893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "moderation_results_target_type_enum" AS ENUM ('message', 'user', 'profile', 'image')
    `);

    await queryRunner.query(`
      CREATE TYPE "moderation_results_action_enum" AS ENUM ('NONE', 'WARN', 'HIDE', 'DELETE')
    `);

    await queryRunner.query(`
      CREATE TYPE "moderation_results_review_status_enum" AS ENUM ('NOT_REQUIRED', 'PENDING', 'REVIEWED')
    `);

    await queryRunner.query(`
      CREATE TABLE "moderation_results" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "targetType" "moderation_results_target_type_enum" NOT NULL,
        "targetId" uuid NOT NULL,
        "flagged" boolean NOT NULL DEFAULT false,
        "categories" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "confidence" double precision NOT NULL DEFAULT 0,
        "aiFlagged" boolean NOT NULL DEFAULT false,
        "aiConfidence" double precision NOT NULL DEFAULT 0,
        "action" "moderation_results_action_enum" NOT NULL DEFAULT 'NONE',
        "aiAction" "moderation_results_action_enum" NOT NULL DEFAULT 'NONE',
        "reviewStatus" "moderation_results_review_status_enum" NOT NULL DEFAULT 'NOT_REQUIRED',
        "reviewedByAI" boolean NOT NULL DEFAULT true,
        "reviewedByHuman" boolean NOT NULL DEFAULT false,
        "overrideReason" text,
        "provider" varchar(50),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "humanReviewQueuedAt" TIMESTAMP,
        "humanReviewedAt" TIMESTAMP,
        "feedbackTrainedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_moderation_results_target_type" ON "moderation_results"("targetType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_moderation_results_target_id" ON "moderation_results"("targetId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_moderation_results_flagged" ON "moderation_results"("flagged")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_moderation_results_action" ON "moderation_results"("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_moderation_results_review_status" ON "moderation_results"("reviewStatus")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_moderation_results_review_status"`);
    await queryRunner.query(`DROP INDEX "idx_moderation_results_action"`);
    await queryRunner.query(`DROP INDEX "idx_moderation_results_flagged"`);
    await queryRunner.query(`DROP INDEX "idx_moderation_results_target_id"`);
    await queryRunner.query(`DROP INDEX "idx_moderation_results_target_type"`);
    await queryRunner.query(`DROP TABLE "moderation_results"`);
    await queryRunner.query(`DROP TYPE "moderation_results_review_status_enum"`);
    await queryRunner.query(`DROP TYPE "moderation_results_action_enum"`);
    await queryRunner.query(`DROP TYPE "moderation_results_target_type_enum"`);
  }
}
