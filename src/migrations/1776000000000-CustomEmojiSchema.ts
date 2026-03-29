import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomEmojiSchema1776000000000 implements MigrationInterface {
  name = 'CustomEmojiSchema1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "custom_emojis" (
        "id"          uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
        "groupId"     uuid          NOT NULL,
        "uploadedBy"  uuid          NOT NULL,
        "name"        varchar(32)   NOT NULL,
        "imageUrl"    text          NOT NULL,
        "fileKey"     varchar(512)  NOT NULL,
        "usageCount"  int           NOT NULL DEFAULT 0,
        "isActive"    boolean       NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "fk_custom_emojis_uploader"
          FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_custom_emojis_group_id" ON "custom_emojis"("groupId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_custom_emojis_group_name" ON "custom_emojis"("groupId", "name") WHERE "isActive" = true`);
    await queryRunner.query(`CREATE INDEX "idx_custom_emojis_is_active" ON "custom_emojis"("isActive")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_custom_emojis_is_active"`);
    await queryRunner.query(`DROP INDEX "idx_custom_emojis_group_name"`);
    await queryRunner.query(`DROP INDEX "idx_custom_emojis_group_id"`);
    await queryRunner.query(`DROP TABLE "custom_emojis"`);
  }
}
