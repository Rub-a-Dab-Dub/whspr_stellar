import { MigrationInterface, QueryRunner } from 'typeorm';

export class BadgesSchema1736000000000 implements MigrationInterface {
  name = 'BadgesSchema1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "badge_tier_enum" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')
    `);

    await queryRunner.query(`
      CREATE TYPE "badge_key_enum" AS ENUM (
        'FIRST_TRANSFER', 'TOP_REFERRER', 'CHAT_CHAMPION',
        'DAO_VOTER', 'EARLY_ADOPTER', 'CRYPTO_WHALE', 'GROUP_FOUNDER'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "badges" (
        "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "key"         "badge_key_enum"  NOT NULL UNIQUE,
        "name"        varchar(100)      NOT NULL,
        "description" text              NOT NULL,
        "iconUrl"     varchar(500),
        "tier"        "badge_tier_enum" NOT NULL DEFAULT 'BRONZE',
        "criteria"    jsonb             NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_badges" (
        "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"      uuid    NOT NULL,
        "badgeId"     uuid    NOT NULL,
        "isDisplayed" boolean NOT NULL DEFAULT false,
        "awardedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_badges_user_badge" UNIQUE ("userId", "badgeId"),
        CONSTRAINT "fk_user_badges_badge"
          FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_badges_key" ON "badges"("key")`);
    await queryRunner.query(`CREATE INDEX "idx_user_badges_user_id" ON "user_badges"("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_badges_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_badges_key"`);
    await queryRunner.query(`DROP TABLE "user_badges"`);
    await queryRunner.query(`DROP TABLE "badges"`);
    await queryRunner.query(`DROP TYPE "badge_key_enum"`);
    await queryRunner.query(`DROP TYPE "badge_tier_enum"`);
  }
}
