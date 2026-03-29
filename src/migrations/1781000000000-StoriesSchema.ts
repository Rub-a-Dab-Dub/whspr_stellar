import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoriesSchema1781000000000 implements MigrationInterface {
  name = 'StoriesSchema1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "story_content_type_enum" AS ENUM ('TEXT', 'IMAGE', 'VIDEO')
    `);
    await queryRunner.query(`
      CREATE TABLE "stories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "contentType" "story_content_type_enum" NOT NULL,
        "content" text,
        "mediaUrl" varchar,
        "backgroundColor" varchar,
        "duration" integer NOT NULL DEFAULT 86400000,
        "viewCount" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_stories_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_stories_user_expires" ON "stories"("userId", "expiresAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "story_views" (
        "storyId" uuid NOT NULL,
        "viewerId" uuid NOT NULL,
        "viewedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY ("storyId", "viewerId"),
        CONSTRAINT "FK_story_views_story" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_story_views_viewer" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "story_views"`);
    await queryRunner.query(`DROP TABLE "stories"`);
    await queryRunner.query(`DROP TYPE "story_content_type_enum"`);
  }
}
