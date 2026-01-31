import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserStatsTables1769750400000 implements MigrationInterface {
  name = 'CreateUserStatsTables1769750400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_stats" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "messages_sent" integer NOT NULL DEFAULT 0,
        "rooms_created" integer NOT NULL DEFAULT 0,
        "rooms_joined" integer NOT NULL DEFAULT 0,
        "tips_sent" integer NOT NULL DEFAULT 0,
        "tips_received" integer NOT NULL DEFAULT 0,
        "tokens_transferred" numeric(30,8) NOT NULL DEFAULT '0',
        "last_active_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stats_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stats_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_user_stats_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_stats_user_id" ON "user_stats" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_stats_daily" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "date" date NOT NULL,
        "messages_sent" integer NOT NULL DEFAULT 0,
        "rooms_created" integer NOT NULL DEFAULT 0,
        "rooms_joined" integer NOT NULL DEFAULT 0,
        "tips_sent" integer NOT NULL DEFAULT 0,
        "tips_received" integer NOT NULL DEFAULT 0,
        "tokens_transferred" numeric(30,8) NOT NULL DEFAULT '0',
        "is_active" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stats_daily_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stats_daily_user_date" UNIQUE ("user_id", "date"),
        CONSTRAINT "FK_user_stats_daily_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_stats_daily_user_id" ON "user_stats_daily" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_stats_weekly" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "week_start" date NOT NULL,
        "week_end" date NOT NULL,
        "messages_sent" integer NOT NULL DEFAULT 0,
        "rooms_created" integer NOT NULL DEFAULT 0,
        "rooms_joined" integer NOT NULL DEFAULT 0,
        "tips_sent" integer NOT NULL DEFAULT 0,
        "tips_received" integer NOT NULL DEFAULT 0,
        "tokens_transferred" numeric(30,8) NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stats_weekly_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stats_weekly_user_week" UNIQUE ("user_id", "week_start"),
        CONSTRAINT "FK_user_stats_weekly_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_stats_weekly_user_id" ON "user_stats_weekly" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_stats_weekly_user_id"`);
    await queryRunner.query(`DROP TABLE "user_stats_weekly"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_user_stats_daily_user_id"`);
    await queryRunner.query(`DROP TABLE "user_stats_daily"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_user_stats_user_id"`);
    await queryRunner.query(`DROP TABLE "user_stats"`);
  }
}
