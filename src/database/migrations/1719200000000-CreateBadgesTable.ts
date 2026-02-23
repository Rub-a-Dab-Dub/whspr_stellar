import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBadgesTable1719200000000 implements MigrationInterface {
  name = 'CreateBadgesTable1719200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."badges_category_enum" AS ENUM('achievement','milestone','special','seasonal')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."badges_rarity_enum" AS ENUM('common','rare','epic','legendary')
    `);

    await queryRunner.query(`
      CREATE TABLE "badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "imageUrl" character varying,
        "category" "public"."badges_category_enum" NOT NULL DEFAULT 'achievement',
        "rarity" "public"."badges_rarity_enum" NOT NULL DEFAULT 'common',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_badges_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_badges_name" ON "badges" ("name")
    `);

    await queryRunner.query(`
      ALTER TABLE "badges" ADD CONSTRAINT "FK_badges_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_badges_createdAt" ON "badges" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_badges_createdAt"`);
    await queryRunner.query(`ALTER TABLE "badges" DROP CONSTRAINT "FK_badges_createdBy"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_badges_name"`);
    await queryRunner.query(`DROP TABLE "badges"`);
    await queryRunner.query(`DROP TYPE "public"."badges_rarity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."badges_category_enum"`);
  }
}
