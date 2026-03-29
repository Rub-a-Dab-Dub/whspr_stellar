import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrustNetworkEntities1730000000000 implements MigrationInterface {
  name = 'TrustNetworkEntities1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "vouches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "voucherId" uuid NOT NULL,
        "vouchedId" uuid NOT NULL,
        "trustScore" numeric(3,2) NOT NULL,
        "comment" character varying,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vouch_id" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`
      CREATE TABLE "trust_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "score" numeric(5,2) NOT NULL DEFAULT '0',
        "vouchCount" integer NOT NULL DEFAULT 0,
        "revokedCount" integer NOT NULL DEFAULT 0,
        "networkDepth" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "calculatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trust_score_id" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_vouches_voucher_vouched" ON "vouches" ("voucherId", "vouchedId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_trust_scores_user_id" ON "trust_scores" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_trust_scores_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_vouches_voucher_vouched"`);
    await queryRunner.query(`DROP TABLE "trust_scores"`);
    await queryRunner.query(`DROP TABLE "vouches"`);
  }
}
