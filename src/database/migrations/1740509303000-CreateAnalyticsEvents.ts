import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalyticsEvents1740509303000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE analytics_event_type AS ENUM (
        'USER_LOGIN',
        'MESSAGE_SENT',
        'TIP_SENT',
        'ROOM_JOINED',
        'ROOM_CREATED',
        'QUEST_COMPLETED'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "eventType" analytics_event_type NOT NULL,
        metadata JSONB,
        "ipAddress" VARCHAR,
        "userAgent" VARCHAR,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_analytics_userId_createdAt ON analytics_events ("userId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX idx_analytics_eventType_createdAt ON analytics_events ("eventType", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX idx_analytics_userId ON analytics_events ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX idx_analytics_eventType ON analytics_events ("eventType");
    `);

    await queryRunner.query(`
      CREATE INDEX idx_analytics_createdAt ON analytics_events ("createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE analytics_events;`);
    await queryRunner.query(`DROP TYPE analytics_event_type;`);
  }
}
