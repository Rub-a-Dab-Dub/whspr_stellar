import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnchorTables1743300000000 implements MigrationInterface {
  name = 'CreateAnchorTables1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "anchors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "homeDomain" character varying(255) NOT NULL,
        "currency" character varying(10) NOT NULL,
        "country" character varying(3),
        "supportedSEPs" text NOT NULL DEFAULT '',
        "isActive" boolean NOT NULL DEFAULT true,
        "logoUrl" text,
        "feeStructure" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_anchors_home_domain" UNIQUE ("homeDomain"),
        CONSTRAINT "PK_anchors" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_anchor_home_domain" ON "anchors" ("homeDomain")`);

    await queryRunner.query(`
      CREATE TYPE "anchor_transactions_type_enum" AS ENUM ('DEPOSIT', 'WITHDRAWAL')
    `);

    await queryRunner.query(`
      CREATE TYPE "anchor_transactions_status_enum" AS ENUM (
        'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "anchor_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "anchorId" uuid NOT NULL,
        "type" "anchor_transactions_type_enum" NOT NULL,
        "assetCode" character varying(12) NOT NULL,
        "amount" numeric(20,7),
        "fiatAmount" numeric(20,2),
        "fiatCurrency" character varying(3),
        "stellarTxHash" character varying(128),
        "anchorTxId" character varying(255),
        "status" "anchor_transactions_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_anchor_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_anchor_tx_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_anchor_tx_anchor" FOREIGN KEY ("anchorId") REFERENCES "anchors"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_anchor_tx_user_id" ON "anchor_transactions" ("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_anchor_tx_anchor_id" ON "anchor_transactions" ("anchorId")`);
    await queryRunner.query(`CREATE INDEX "idx_anchor_tx_status" ON "anchor_transactions" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "anchor_transactions"`);
    await queryRunner.query(`DROP TYPE "anchor_transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "anchor_transactions_type_enum"`);
    await queryRunner.query(`DROP TABLE "anchors"`);
  }
}
