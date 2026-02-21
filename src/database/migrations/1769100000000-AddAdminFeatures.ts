import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminFeatures1769100000000 implements MigrationInterface {
  name = 'AddAdminFeatures1769100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add ban fields to users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "isBanned" boolean NOT NULL DEFAULT false,
      ADD COLUMN "bannedAt" TIMESTAMP,
      ADD COLUMN "bannedBy" uuid,
      ADD COLUMN "banReason" text,
      ADD COLUMN "suspendedUntil" TIMESTAMP,
      ADD COLUMN "suspendedAt" TIMESTAMP,
      ADD COLUMN "suspendedBy" uuid,
      ADD COLUMN "suspensionReason" text,
      ADD COLUMN "isVerified" boolean NOT NULL DEFAULT false,
      ADD COLUMN "verifiedAt" TIMESTAMP,
      ADD COLUMN "verifiedBy" uuid
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_action_enum" AS ENUM(
        'user.banned',
        'user.unbanned',
        'user.suspended',
        'user.unsuspended',
        'user.verified',
        'user.unverified',
        'user.viewed',
        'user.updated',
        'user.deleted',
        'bulk.action',
        'impersonation.started',
        'impersonation.ended'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action" "public"."audit_logs_action_enum" NOT NULL,
        "adminId" uuid NOT NULL,
        "targetUserId" uuid,
        "details" text,
        "metadata" jsonb,
        "ipAddress" inet,
        "userAgent" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_admin" FOREIGN KEY ("adminId") 
          REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_audit_logs_target_user" FOREIGN KEY ("targetUserId") 
          REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_admin" ON "audit_logs" ("adminId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_target_user" ON "audit_logs" ("targetUserId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop audit_logs table
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_audit_logs_target_user"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_admin"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."audit_logs_action_enum"`,
    );

    // Remove ban fields from users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "isBanned",
      DROP COLUMN IF EXISTS "bannedAt",
      DROP COLUMN IF EXISTS "bannedBy",
      DROP COLUMN IF EXISTS "banReason",
      DROP COLUMN IF EXISTS "suspendedUntil",
      DROP COLUMN IF EXISTS "suspendedAt",
      DROP COLUMN IF EXISTS "suspendedBy",
      DROP COLUMN IF EXISTS "suspensionReason",
      DROP COLUMN IF EXISTS "isVerified",
      DROP COLUMN IF EXISTS "verifiedAt",
      DROP COLUMN IF EXISTS "verifiedBy"
    `);
  }
}
