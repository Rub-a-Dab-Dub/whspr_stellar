import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStickerPacksUgcSchema1775400000000 implements MigrationInterface {
  name = 'UserStickerPacksUgcSchema1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_sticker_packs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "creatorId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "description" text,
        "coverUrl" text,
        "isPublished" boolean NOT NULL DEFAULT false,
        "isApproved" boolean NOT NULL DEFAULT false,
        "downloadCount" int NOT NULL DEFAULT 0,
        "price" decimal(10,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_sticker_packs_creator" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_sticker_packs_creator" ON "user_sticker_packs" ("creatorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sticker_packs_public" ON "user_sticker_packs" ("isPublished", "isApproved")`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_stickers_ugc" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "packId" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "fileKey" text NOT NULL,
        "fileUrl" text NOT NULL,
        "tags" text NOT NULL DEFAULT '',
        "sort_order" int NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_stickers_ugc_pack" FOREIGN KEY ("packId") REFERENCES "user_sticker_packs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_stickers_ugc_pack" ON "user_stickers_ugc" ("packId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_sticker_pack_downloads" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "packId" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_pack_download" UNIQUE ("userId", "packId"),
        CONSTRAINT "FK_ugc_dl_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ugc_dl_pack" FOREIGN KEY ("packId") REFERENCES "user_sticker_packs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ugc_pack_dl_user" ON "user_sticker_pack_downloads" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_sticker_pack_downloads"`);
    await queryRunner.query(`DROP TABLE "user_stickers_ugc"`);
    await queryRunner.query(`DROP TABLE "user_sticker_packs"`);
  }
}
