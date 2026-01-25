import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStreakSystem1769346610000 implements MigrationInterface {
  name = 'CreateStreakSystem1769346610000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create streak table
    await queryRunner.query(`
      CREATE TABLE "streaks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "current_streak" integer NOT NULL DEFAULT '0',
        "longest_streak" integer NOT NULL DEFAULT '0',
        "last_login_date" date,
        "freeze_items" integer NOT NULL DEFAULT '0',
        "grace_period_end" TIMESTAMP,
        "streak_multiplier" numeric(3,2) NOT NULL DEFAULT '1.00',
        "total_days_logged" integer NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_streaks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_streaks_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_streaks_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_streaks_user_id" ON "streaks" ("user_id")
    `);

    // Create streak_rewards table
    await queryRunner.query(`
      CREATE TYPE "public"."streak_rewards_reward_type_enum" AS ENUM('xp', 'token', 'badge', 'premium')
    `);

    await queryRunner.query(`
      CREATE TABLE "streak_rewards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "milestone" integer NOT NULL,
        "reward_type" "public"."streak_rewards_reward_type_enum" NOT NULL,
        "reward_amount" integer,
        "reward_description" character varying(100),
        "claimed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_streak_rewards_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_streak_rewards_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_streak_rewards_user_claimed" ON "streak_rewards" ("user_id", "claimed_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_streak_rewards_user_milestone" ON "streak_rewards" ("user_id", "milestone")
    `);

    // Create streak_badges table
    await queryRunner.query(`
      CREATE TYPE "public"."streak_badges_badge_type_enum" AS ENUM(
        'streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_60', 
        'streak_100', 'streak_365', 'longest_streak_10', 'longest_streak_30', 'longest_streak_100'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "streak_badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "badge_type" "public"."streak_badges_badge_type_enum" NOT NULL,
        "description" character varying(200),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_streak_badges_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_streak_badges_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_streak_badges_user_badge" UNIQUE ("user_id", "badge_type")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_streak_badges_user_id" ON "streak_badges" ("user_id")
    `);

    // Create streak_history table
    await queryRunner.query(`
      CREATE TYPE "public"."streak_history_action_enum" AS ENUM(
        'login', 'increment', 'reset', 'freeze_used', 'grace_period_used', 'reward_claimed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "streak_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "action" "public"."streak_history_action_enum" NOT NULL,
        "streak_before" integer,
        "streak_after" integer,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_streak_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_streak_history_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_streak_history_user_created" ON "streak_history" ("user_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_streak_history_user_created"`);
    await queryRunner.query(`DROP TABLE "streak_history"`);
    await queryRunner.query(`DROP TYPE "public"."streak_history_action_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_streak_badges_user_id"`);
    await queryRunner.query(`DROP TABLE "streak_badges"`);
    await queryRunner.query(`DROP TYPE "public"."streak_badges_badge_type_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_streak_rewards_user_milestone"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_streak_rewards_user_claimed"`);
    await queryRunner.query(`DROP TABLE "streak_rewards"`);
    await queryRunner.query(`DROP TYPE "public"."streak_rewards_reward_type_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_streaks_user_id"`);
    await queryRunner.query(`DROP TABLE "streaks"`);
  }
}
