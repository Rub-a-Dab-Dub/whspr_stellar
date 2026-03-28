import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttachmentsSchema1711234567893 implements MigrationInterface {
  name = 'AttachmentsSchema1711234567893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "uploaderId" uuid NOT NULL,
        "fileUrl" text NOT NULL,
        "fileKey" varchar(512) NOT NULL UNIQUE,
        "fileName" varchar(255) NOT NULL,
        "fileSize" integer NOT NULL,
        "mimeType" varchar(255) NOT NULL,
        "width" integer,
        "height" integer,
        "duration" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_attachments_uploader"
          FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_attachments_message_id" ON "attachments"("messageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attachments_uploader_id" ON "attachments"("uploaderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attachments_file_key" ON "attachments"("fileKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_attachments_file_key"`);
    await queryRunner.query(`DROP INDEX "idx_attachments_uploader_id"`);
    await queryRunner.query(`DROP INDEX "idx_attachments_message_id"`);
    await queryRunner.query(`DROP TABLE "attachments"`);
  }
}
