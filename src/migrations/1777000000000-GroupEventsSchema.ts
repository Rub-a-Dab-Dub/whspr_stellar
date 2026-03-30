import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupEventsSchema1777000000000 implements MigrationInterface {
  name = 'GroupEventsSchema1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "event_type_enum" AS ENUM ('VIRTUAL', 'PHYSICAL')`);
    await queryRunner.query(`CREATE TYPE "event_status_enum" AS ENUM ('ACTIVE', 'CANCELLED')`);
    await queryRunner.query(`CREATE TYPE "rsvp_status_enum" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING', 'WAITLISTED')`);

    await queryRunner.query(`
      CREATE TABLE "group_events" (
        "id"           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
        "groupId"      uuid          NOT NULL,
        "createdBy"    uuid          NOT NULL,
        "title"        varchar(200)  NOT NULL,
        "description"  text          NULL,
        "eventType"    event_type_enum NOT NULL,
        "location"     varchar(500)  NULL,
        "meetingUrl"   text          NULL,
        "startTime"    TIMESTAMP     NOT NULL,
        "endTime"      TIMESTAMP     NOT NULL,
        "maxAttendees" int           NULL,
        "isPublic"     boolean       NOT NULL DEFAULT true,
        "status"       event_status_enum NOT NULL DEFAULT 'ACTIVE',
        "reminderSent" boolean       NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "fk_group_events_creator"
          FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_group_events_group_id" ON "group_events"("groupId")`);
    await queryRunner.query(`CREATE INDEX "idx_group_events_start_time" ON "group_events"("startTime")`);
    await queryRunner.query(`CREATE INDEX "idx_group_events_status" ON "group_events"("status")`);

    await queryRunner.query(`
      CREATE TABLE "event_rsvps" (
        "id"          uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
        "eventId"     uuid          NOT NULL,
        "userId"      uuid          NOT NULL,
        "status"      rsvp_status_enum NOT NULL,
        "respondedAt" TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "uq_event_rsvps_event_user" UNIQUE ("eventId", "userId"),
        CONSTRAINT "fk_event_rsvps_event"
          FOREIGN KEY ("eventId") REFERENCES "group_events"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_event_rsvps_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_event_rsvps_event_id" ON "event_rsvps"("eventId")`);
    await queryRunner.query(`CREATE INDEX "idx_event_rsvps_user_id" ON "event_rsvps"("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_event_rsvps_event_status" ON "event_rsvps"("eventId", "status")`);

    // Add new notification types to the enum
    await queryRunner.query(`ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'GROUP_EVENT'`);
    await queryRunner.query(`ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'EVENT_REMINDER'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_event_rsvps_event_status"`);
    await queryRunner.query(`DROP INDEX "idx_event_rsvps_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_event_rsvps_event_id"`);
    await queryRunner.query(`DROP TABLE "event_rsvps"`);
    await queryRunner.query(`DROP INDEX "idx_group_events_status"`);
    await queryRunner.query(`DROP INDEX "idx_group_events_start_time"`);
    await queryRunner.query(`DROP INDEX "idx_group_events_group_id"`);
    await queryRunner.query(`DROP TABLE "group_events"`);
    await queryRunner.query(`DROP TYPE "rsvp_status_enum"`);
    await queryRunner.query(`DROP TYPE "event_status_enum"`);
    await queryRunner.query(`DROP TYPE "event_type_enum"`);
  }
}
