import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsSchema1711234567898 implements MigrationInterface {
  name = 'NotificationsSchema1711234567898';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'NEW_MESSAGE',
        'TRANSFER_RECEIVED',
        'GROUP_INVITE',
        'CONTACT_REQUEST',
        'PROPOSAL_VOTE',
        'TRANSACTION_CONFIRMED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "title" varchar(160) NOT NULL,
        "body" text NOT NULL,
        "data" jsonb,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_notifications_type" ON "notifications"("type")`);
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_created" ON "notifications"("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_is_read" ON "notifications"("userId", "isRead")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_deleted_at" ON "notifications"("deletedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_notifications_deleted_at"`);
    await queryRunner.query(`DROP INDEX "idx_notifications_user_is_read"`);
    await queryRunner.query(`DROP INDEX "idx_notifications_user_created"`);
    await queryRunner.query(`DROP INDEX "idx_notifications_type"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
  }
}
