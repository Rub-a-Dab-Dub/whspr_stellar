import { MigrationInterface, QueryRunner } from 'typeorm';

export class RevenueFeeEntities1730000000000 implements MigrationInterface {
  name = 'RevenueFeeEntities1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "revenue_source_type" AS ENUM('TRANSFER_FEE', 'SUBSCRIPTION', 'SWAP_FEE', 'TREASURY_FEE');
    `);

    await queryRunner.query(`
      CREATE TABLE "revenue_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sourceType" "revenue_source_type" NOT NULL,
        "sourceId" uuid NOT NULL,
        "amount" numeric(38,7) NOT NULL,
        "tokenId" varchar(44) NOT NULL,
        "usdValue" numeric(20,2) NOT NULL,
        "period" date NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_revenue_period_source" ON "revenue_records" ("period", "sourceType");
      CREATE INDEX "idx_revenue_source_token" ON "revenue_records" ("sourceType", "tokenId");
      CREATE INDEX "idx_revenue_source_id" ON "revenue_records" ("sourceType", "sourceId");
    `);

    await queryRunner.query(`
      CREATE TABLE "fee_distributions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "period" date NOT NULL,
        "totalCollected" numeric(38,7) NOT NULL,
        "platformShare" numeric(38,7) NOT NULL,
        "stakeholderDistributions" jsonb NOT NULL,
        "distributedAt" timestamp,
        "txHash" varchar(64),
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fee_distributions"`);
    await queryRunner.query(`DROP INDEX "idx_revenue_source_id"`);
    await queryRunner.query(`DROP INDEX "idx_revenue_source_token"`);
    await queryRunner.query(`DROP INDEX "idx_revenue_period_source"`);
    await queryRunner.query(`DROP TABLE "revenue_records"`);
    await queryRunner.query(`DROP TYPE "revenue_source_type"`);
  }
}

