import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppVersionsSchema1765000000000 implements MigrationInterface {
  name = 'AppVersionsSchema1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."app_versions_platform_enum" AS ENUM('IOS', 'ANDROID', 'WEB')
    `);
    await queryRunner.query(`
      CREATE TABLE "app_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "platform" "public"."app_versions_platform_enum" NOT NULL,
        "version" character varying(50) NOT NULL,
        "minSupportedVersion" character varying(50) NOT NULL,
        "releaseNotes" text,
        "isForceUpdate" boolean NOT NULL DEFAULT false,
        "isSoftUpdate" boolean NOT NULL DEFAULT false,
        "publishedAt" TIMESTAMP NOT NULL,
        "isDeprecated" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_versions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_app_versions_platform" ON "app_versions" ("platform")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_app_versions_platform_publishedAt" ON "app_versions" ("platform", "publishedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_app_versions_platform_publishedAt"`);
    await queryRunner.query(`DROP INDEX "public"."idx_app_versions_platform"`);
    await queryRunner.query(`DROP TABLE "app_versions"`);
    await queryRunner.query(`DROP TYPE "public"."app_versions_platform_enum"`);
  }
}
