import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommandFrameworkBotCommands17470000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new table for framework commands (separate from bots.bot_commands)
    await queryRunner.query(`
      CREATE TABLE "command_framework_bot_commands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" character varying NOT NULL,
        "command" character varying(64) NOT NULL,
        "description" character varying(255) NOT NULL,
        "usage" character varying(255) NOT NULL,
        "scope" character varying NOT NULL DEFAULT 'global',
        "isEnabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_command_framework_bot_commands" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_bot_commands_command" ON "command_framework_bot_commands" ("command")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_bot_commands_bot_id" ON "command_framework_bot_commands" ("botId")
    `);

    // Seed built-in commands
    await queryRunner.query(`
      INSERT INTO "command_framework_bot_commands" (botId, command, description, usage, scope, isEnabled) VALUES
      (NULL, 'help', 'Show available commands', '/help', 'built_in', true),
      (NULL, 'balance', 'Show your balance', '/balance', 'built_in', true),
      (NULL, 'pay', 'Send payment to user', '/pay @user amount token', 'built_in', true),
      (NULL, 'request', 'Request payment from user', '/request @user amount token', 'built_in', true),
      (NULL, 'price', 'Get token price', '/price TOKEN', 'built_in', true),
      (NULL, 'swap', 'Swap tokens', '/swap FROM TO amount', 'built_in', true),
      (NULL, 'members', 'List group members', '/members', 'built_in', true),
      (NULL, 'mute', 'Mute conversation', '/mute', 'built_in', true),
      (NULL, 'poll', 'Create poll', '/poll "Question" | "Option1" | "Option2"', 'built_in', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "command_framework_bot_commands"`);
  }
}

