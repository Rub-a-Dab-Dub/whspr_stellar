import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppConfigSchema1734000000000 implements MigrationInterface {
  name = 'AppConfigSchema1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_config" (
        "key"         varchar(128) PRIMARY KEY,
        "value"       jsonb NOT NULL,
        "valueType"   varchar(16) NOT NULL,
        "description" text,
        "isPublic"    boolean NOT NULL DEFAULT false,
        "updatedBy"   uuid,
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_app_config_is_public" ON "app_config"("isPublic")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_app_config_is_public"`);
    await queryRunner.query(`DROP TABLE "app_config"`);
  }
}
