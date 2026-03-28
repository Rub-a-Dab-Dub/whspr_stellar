import { MigrationInterface, QueryRunner } from 'typeorm';

export class BotsSchema1743200000000 implements MigrationInterface {
  name = 'BotsSchema1743200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "username" varchar(64) NOT NULL UNIQUE,
        "avatarUrl" text,
        "webhookUrl" text NOT NULL,
        "webhookSecret" varchar(255) NOT NULL,
        "scopes" text[] NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_bots_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bots_owner_id" ON "bots"("ownerId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bots_username" ON "bots"("username")
    `);

    await queryRunner.query(`
      CREATE TABLE "bot_commands" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "command" varchar(64) NOT NULL,
        "description" varchar(255) NOT NULL,
        "usage" varchar(255) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_bot_commands_bot_command" UNIQUE ("botId", "command"),
        CONSTRAINT "fk_bot_commands_bot" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bot_commands_bot_id" ON "bot_commands"("botId")
    `);

    await queryRunner.query(`
      CREATE TABLE "bot_group_members" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "groupId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "isBot" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_bot_group_members_group_bot" UNIQUE ("groupId", "botId"),
        CONSTRAINT "fk_bot_group_members_bot" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bot_group_members_group_id" ON "bot_group_members"("groupId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bot_group_members_bot_id" ON "bot_group_members"("botId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_bot_group_members_bot_id"`);
    await queryRunner.query(`DROP INDEX "idx_bot_group_members_group_id"`);
    await queryRunner.query(`DROP TABLE "bot_group_members"`);

    await queryRunner.query(`DROP INDEX "idx_bot_commands_bot_id"`);
    await queryRunner.query(`DROP TABLE "bot_commands"`);

    await queryRunner.query(`DROP INDEX "idx_bots_username"`);
    await queryRunner.query(`DROP INDEX "idx_bots_owner_id"`);
    await queryRunner.query(`DROP TABLE "bots"`);
  }
}
