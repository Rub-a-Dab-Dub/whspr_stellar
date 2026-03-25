import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReputationSchema1711234567895 implements MigrationInterface {
  name = 'ReputationSchema1711234567895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reputation_scores" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"          uuid NOT NULL,
        "score"           numeric(5,2) NOT NULL DEFAULT 0,
        "totalRatings"    integer NOT NULL DEFAULT 0,
        "positiveRatings" integer NOT NULL DEFAULT 0,
        "flags"           integer NOT NULL DEFAULT 0,
        "isUnderReview"   boolean NOT NULL DEFAULT false,
        "onChainScore"    numeric(5,2),
        "lastChainSyncAt" TIMESTAMP,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "lastUpdatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_reputation_scores_user_id" UNIQUE ("userId"),
        CONSTRAINT "fk_reputation_scores_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_ratings" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "raterId"        uuid NOT NULL,
        "ratedUserId"    uuid NOT NULL,
        "conversationId" uuid NOT NULL,
        "score"          smallint NOT NULL CHECK ("score" BETWEEN 1 AND 5),
        "comment"        varchar(280),
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_rating_rater_conversation" UNIQUE ("raterId", "conversationId"),
        CONSTRAINT "fk_user_ratings_rater"
          FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_ratings_rated"
          FOREIGN KEY ("ratedUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_reputation_scores_user_id" ON "reputation_scores"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_ratings_rater_id" ON "user_ratings"("raterId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_ratings_rated_user_id" ON "user_ratings"("ratedUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_ratings_conversation_id" ON "user_ratings"("conversationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_ratings_conversation_id"`);
    await queryRunner.query(`DROP INDEX "idx_user_ratings_rated_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_user_ratings_rater_id"`);
    await queryRunner.query(`DROP INDEX "idx_reputation_scores_user_id"`);
    await queryRunner.query(`DROP TABLE "user_ratings"`);
    await queryRunner.query(`DROP TABLE "reputation_scores"`);
  }
}
