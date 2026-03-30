import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentGatesSchema1782000000000 implements MigrationInterface {
  name = 'ContentGatesSchema1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "gated_content_type_enum" AS ENUM ('MESSAGE', 'THREAD', 'CHANNEL', 'FILE')
    `);
    await queryRunner.query(`
      CREATE TYPE "gate_type_enum" AS ENUM ('FUNGIBLE', 'NFT', 'STAKING_TIER')
    `);
    await queryRunner.query(`
      CREATE TABLE "content_gates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contentType" "gated_content_type_enum" NOT NULL,
        "contentId" varchar(128) NOT NULL,
        "createdBy" uuid NOT NULL,
        "gateType" "gate_type_enum" NOT NULL,
        "gateToken" varchar(256) NOT NULL,
        "minBalance" varchar(64) NOT NULL DEFAULT '0',
        "network" varchar(32) NOT NULL DEFAULT 'stellar_mainnet',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_content_gates_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_content_gates_target" ON "content_gates"("contentType", "contentId", "isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_content_gates_active" ON "content_gates"("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_content_gates_active"`);
    await queryRunner.query(`DROP INDEX "idx_content_gates_target"`);
    await queryRunner.query(`DROP TABLE "content_gates"`);
    await queryRunner.query(`DROP TYPE "gate_type_enum"`);
    await queryRunner.query(`DROP TYPE "gated_content_type_enum"`);
  }
}
