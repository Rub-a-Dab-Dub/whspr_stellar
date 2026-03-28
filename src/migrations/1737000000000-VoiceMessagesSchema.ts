import { MigrationInterface, QueryRunner } from 'typeorm';

export class VoiceMessagesSchema1737000000000 implements MigrationInterface {
  name = 'VoiceMessagesSchema1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "voice_messages" (
        "id"           uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
        "messageId"    uuid    NOT NULL,
        "uploaderId"   uuid    NOT NULL,
        "fileKey"      varchar(512) NOT NULL UNIQUE,
        "fileUrl"      text    NOT NULL,
        "duration"     integer,
        "waveformData" jsonb,
        "mimeType"     varchar(100) NOT NULL,
        "fileSize"     integer NOT NULL,
        "confirmed"    boolean NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_voice_messages_message_id"  ON "voice_messages"("messageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_voice_messages_uploader_id" ON "voice_messages"("uploaderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_voice_messages_file_key"    ON "voice_messages"("fileKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_voice_messages_file_key"`);
    await queryRunner.query(`DROP INDEX "idx_voice_messages_uploader_id"`);
    await queryRunner.query(`DROP INDEX "idx_voice_messages_message_id"`);
    await queryRunner.query(`DROP TABLE "voice_messages"`);
  }
}
