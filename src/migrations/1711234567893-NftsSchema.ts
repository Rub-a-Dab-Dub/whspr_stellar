import { MigrationInterface, QueryRunner } from 'typeorm';

export class NftsSchema1711234567893 implements MigrationInterface {
  name = 'NftsSchema1711234567893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "nfts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contractAddress" varchar NOT NULL,
        "tokenId" varchar NOT NULL,
        "ownerId" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "imageUrl" varchar,
        "name" varchar,
        "collection" varchar,
        "network" varchar NOT NULL DEFAULT 'stellar_mainnet',
        "lastSyncedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_NFTS_ASSET" UNIQUE ("network", "contractAddress", "tokenId"),
        CONSTRAINT "FK_NFTS_OWNER" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_NFTS_OWNER" ON "nfts"("ownerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_NFTS_NETWORK" ON "nfts"("network")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_NFTS_NETWORK"`);
    await queryRunner.query(`DROP INDEX "IDX_NFTS_OWNER"`);
    await queryRunner.query(`DROP TABLE "nfts"`);
  }
}
