import { MigrationInterface, QueryRunner } from 'typeorm';

export class PollsSchema1760000000000 implements MigrationInterface {
  name = 'PollsSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "polls" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "createdBy" uuid NOT NULL,
        "question" varchar(300) NOT NULL,
        "options" jsonb NOT NULL,
        "allowMultiple" boolean NOT NULL DEFAULT false,
        "isAnonymous" boolean NOT NULL DEFAULT false,
        "expiresAt" TIMESTAMP NULL,
        "isClosed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_polls_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_polls_created_by"
          FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_polls_conversation_id" ON "polls"("conversationId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_polls_created_by" ON "polls"("createdBy")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_polls_expires_at" ON "polls"("expiresAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_polls_is_closed" ON "polls"("isClosed")
    `);

    await queryRunner.query(`
      CREATE TABLE "poll_votes" (
        "pollId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "optionIndexes" int[] NOT NULL,
        "votedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_poll_votes" PRIMARY KEY ("pollId", "userId"),
        CONSTRAINT "fk_poll_votes_poll"
          FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_poll_votes_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_poll_votes_user_id" ON "poll_votes"("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_poll_votes_user_id"`);
    await queryRunner.query(`DROP TABLE "poll_votes"`);
    await queryRunner.query(`DROP INDEX "idx_polls_is_closed"`);
    await queryRunner.query(`DROP INDEX "idx_polls_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_polls_created_by"`);
    await queryRunner.query(`DROP INDEX "idx_polls_conversation_id"`);
    await queryRunner.query(`DROP TABLE "polls"`);
  }
}
