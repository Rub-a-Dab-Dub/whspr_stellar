import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationSystem1769500000001 implements MigrationInterface {
  name = 'CreateNotificationSystem1769500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipientId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "data" jsonb,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP,
        "senderId" uuid,
        "roomId" uuid,
        "messageId" uuid,
        "actionUrl" character varying,
        "category" character varying(100),
        "priority" integer NOT NULL DEFAULT 1,
        "scheduledFor" TIMESTAMP,
        "sentAt" TIMESTAMP,
        "retryCount" integer NOT NULL DEFAULT 0,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    // Create notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "channel" character varying NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "settings" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_user_type_channel" UNIQUE ("userId", "type", "channel")
      )
    `);

    // Create user_mutes table
    await queryRunner.query(`
      CREATE TABLE "user_mutes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "targetType" character varying NOT NULL,
        "targetId" character varying NOT NULL,
        "expiresAt" TIMESTAMP,
        "reason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_mutes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_mutes_user_target" UNIQUE ("userId", "targetType", "targetId")
      )
    `);

    // Create notification_batches table
    await queryRunner.query(`
      CREATE TABLE "notification_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "totalNotifications" integer NOT NULL DEFAULT 0,
        "sentNotifications" integer NOT NULL DEFAULT 0,
        "failedNotifications" integer NOT NULL DEFAULT 0,
        "scheduledFor" TIMESTAMP,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_batches" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for notifications table
    await queryRunner.query(`CREATE INDEX "IDX_notifications_recipient_created" ON "notifications" ("recipientId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_recipient_read" ON "notifications" ("recipientId", "isRead")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_type_recipient" ON "notifications" ("type", "recipientId")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_status_recipient" ON "notifications" ("status", "recipientId")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_type" ON "notifications" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_scheduled" ON "notifications" ("scheduledFor") WHERE "scheduledFor" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_room" ON "notifications" ("roomId") WHERE "roomId" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_sender" ON "notifications" ("senderId") WHERE "senderId" IS NOT NULL`);

    // Create indexes for notification_preferences table
    await queryRunner.query(`CREATE INDEX "IDX_notification_preferences_user_type" ON "notification_preferences" ("userId", "type")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_preferences_enabled" ON "notification_preferences" ("enabled")`);

    // Create indexes for user_mutes table
    await queryRunner.query(`CREATE INDEX "IDX_user_mutes_user_type" ON "user_mutes" ("userId", "targetType")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_mutes_expires" ON "user_mutes" ("expiresAt") WHERE "expiresAt" IS NOT NULL`);

    // Create indexes for notification_batches table
    await queryRunner.query(`CREATE INDEX "IDX_notification_batches_status_scheduled" ON "notification_batches" ("status", "scheduledFor")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_batches_created" ON "notification_batches" ("createdAt")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "notifications" 
      ADD CONSTRAINT "FK_notifications_recipient" 
      FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "notifications" 
      ADD CONSTRAINT "FK_notifications_sender" 
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_preferences" 
      ADD CONSTRAINT "FK_notification_preferences_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_mutes" 
      ADD CONSTRAINT "FK_user_mutes_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // Create notification type enum constraint
    await queryRunner.query(`
      ALTER TABLE "notifications" 
      ADD CONSTRAINT "CHK_notifications_type" 
      CHECK ("type" IN (
        'message', 'mention', 'reply', 'reaction',
        'room_invitation', 'room_join', 'room_leave', 'room_role_change', 'room_ban', 'room_unban',
        'level_up', 'achievement_unlocked', 'reward_granted', 'reward_expired', 'reward_traded', 'reward_gifted',
        'login_success', 'login_failed', 'password_changed', 'email_changed',
        'user_reported', 'content_flagged', 'moderation_action',
        'announcement', 'maintenance', 'welcome'
      ))
    `);

    // Create notification status enum constraint
    await queryRunner.query(`
      ALTER TABLE "notifications" 
      ADD CONSTRAINT "CHK_notifications_status" 
      CHECK ("status" IN ('pending', 'sent', 'delivered', 'failed', 'cancelled'))
    `);

    // Create notification channel enum constraint
    await queryRunner.query(`
      ALTER TABLE "notification_preferences" 
      ADD CONSTRAINT "CHK_notification_preferences_channel" 
      CHECK ("channel" IN ('in_app', 'push', 'email', 'sms', 'websocket'))
    `);

    // Create mute type enum constraint
    await queryRunner.query(`
      ALTER TABLE "user_mutes" 
      ADD CONSTRAINT "CHK_user_mutes_target_type" 
      CHECK ("targetType" IN ('user', 'room', 'global'))
    `);

    // Create batch status enum constraint
    await queryRunner.query(`
      ALTER TABLE "notification_batches" 
      ADD CONSTRAINT "CHK_notification_batches_status" 
      CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "user_mutes" DROP CONSTRAINT "FK_user_mutes_user"`);
    await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_notification_preferences_user"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_sender"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_recipient"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_notification_batches_created"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_batches_status_scheduled"`);
    await queryRunner.query(`DROP INDEX "IDX_user_mutes_expires"`);
    await queryRunner.query(`DROP INDEX "IDX_user_mutes_user_type"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_preferences_enabled"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_preferences_user_type"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_sender"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_room"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_scheduled"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_type"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_status_recipient"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_type_recipient"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_read"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_created"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "notification_batches"`);
    await queryRunner.query(`DROP TABLE "user_mutes"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}