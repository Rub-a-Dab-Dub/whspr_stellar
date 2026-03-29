import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeeSponsorshipSchema1775300000000 implements MigrationInterface {
  name = 'FeeSponsorshipSchema1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "fee_sponsorships_sponsoredby_enum" AS ENUM ('PLATFORM', 'PARTNER')
    `);

    await queryRunner.query(`
      CREATE TABLE "fee_sponsorships" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "txHash" varchar(128) NOT NULL,
        "feeAmount" varchar(32) NOT NULL,
        "sponsoredBy" "fee_sponsorships_sponsoredby_enum" NOT NULL DEFAULT 'PLATFORM',
        "tokenId" varchar(128),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_fee_sponsorships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_fee_sponsorships_user_created" ON "fee_sponsorships" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_fee_sponsorships_tx_hash" ON "fee_sponsorships" ("txHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_fee_sponsorships_user_id" ON "fee_sponsorships" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "sponsorship_quotas" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "period" varchar(7) NOT NULL,
        "quotaUsed" int NOT NULL DEFAULT 0,
        "quotaLimit" int NOT NULL,
        "resetAt" TIMESTAMPTZ NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_sponsorship_quota_user_period" UNIQUE ("userId", "period"),
        CONSTRAINT "FK_sponsorship_quotas_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sponsorship_quotas_user_period" ON "sponsorship_quotas" ("userId", "period")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sponsorship_quotas"`);
    await queryRunner.query(`DROP TABLE "fee_sponsorships"`);
    await queryRunner.query(`DROP TYPE "fee_sponsorships_sponsoredby_enum"`);
  }
}
