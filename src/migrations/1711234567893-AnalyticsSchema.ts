import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsSchema1711234567893 implements MigrationInterface {
  name = 'AnalyticsSchema1711234567893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "analytics_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventType" varchar(64) NOT NULL,
        "metricKey" varchar(64) NOT NULL,
        "userId" uuid,
        "idempotencyKey" varchar(255) UNIQUE,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_events_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_analytics_events_metric_key_created_at"
      ON "analytics_events" ("metricKey", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_analytics_events_user_id_created_at"
      ON "analytics_events" ("userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "daily_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" date NOT NULL,
        "metricKey" varchar(64) NOT NULL,
        "value" numeric(30,8) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_metrics_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_daily_metrics_date_metric_key"
      ON "daily_metrics" ("date", "metricKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_daily_metrics_date_metric_key"`);
    await queryRunner.query(`DROP TABLE "daily_metrics"`);
    await queryRunner.query(`DROP INDEX "idx_analytics_events_user_id_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_analytics_events_metric_key_created_at"`);
    await queryRunner.query(`DROP TABLE "analytics_events"`);
  }
}
