import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReactionsSchema1711234567899 implements MigrationInterface {
  name = 'ReactionsSchema1711234567899';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "emoji" varchar(32) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_reactions_message_user_emoji" UNIQUE ("messageId", "userId", "emoji")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_reactions_message_id" ON "reactions"("messageId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_reactions_message_emoji" ON "reactions"("messageId", "emoji")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_reactions_message_emoji"`);
    await queryRunner.query(`DROP INDEX "idx_reactions_message_id"`);
    await queryRunner.query(`DROP TABLE "reactions"`);
  }
}
