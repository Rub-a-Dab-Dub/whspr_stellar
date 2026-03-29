import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformInvitesSchema1775100000000 implements MigrationInterface {
  name = 'PlatformInvitesSchema1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdBy" uuid NOT NULL,
        "code" character varying(32) NOT NULL,
        "email" character varying(255),
        "status" character varying(24) NOT NULL,
        "maxUses" integer NOT NULL DEFAULT 1,
        "useCount" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP,
        "revokedAt" TIMESTAMP,
        "lastRedeemedByUserId" uuid,
        "lastRedeemedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_invites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_platform_invites_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_platform_invites_code" ON "platform_invites" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_invites_created_by" ON "platform_invites" ("createdBy")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_invites_status" ON "platform_invites" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "platform_invite_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inviteId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "redeemedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_invite_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_redemptions_invite" FOREIGN KEY ("inviteId") REFERENCES "platform_invites"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_redemptions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_redemptions_invite" ON "platform_invite_redemptions" ("inviteId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_redemptions_user" ON "platform_invite_redemptions" ("userId")`,
    );

    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "value", "description", "createdAt", "updatedAt")
      VALUES (
        'invite_mode_enabled',
        'false',
        'When true, new registrations require a valid platform invite code',
        now(),
        now()
      )
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "system_settings" WHERE "key" = 'invite_mode_enabled'`);
    await queryRunner.query(`DROP INDEX "IDX_redemptions_user"`);
    await queryRunner.query(`DROP INDEX "IDX_redemptions_invite"`);
    await queryRunner.query(`DROP TABLE "platform_invite_redemptions"`);
    await queryRunner.query(`DROP INDEX "IDX_platform_invites_status"`);
    await queryRunner.query(`DROP INDEX "IDX_platform_invites_created_by"`);
    await queryRunner.query(`DROP INDEX "UQ_platform_invites_code"`);
    await queryRunner.query(`DROP TABLE "platform_invites"`);
  }
}
