import { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryUserBlocksSchema1745200000000 implements MigrationInterface {
  name = 'DiscoveryUserBlocksSchema1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "discovery_user_blocks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "blockerId" uuid NOT NULL,
        "blockedId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_discovery_user_blocks_blocker"
          FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_discovery_user_blocks_blocked"
          FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_discovery_user_blocks_not_self"
          CHECK ("blockerId" <> "blockedId")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_discovery_user_blocks_blocker_id" ON "discovery_user_blocks"("blockerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_discovery_user_blocks_blocked_id" ON "discovery_user_blocks"("blockedId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_discovery_user_blocks_pair" ON "discovery_user_blocks"("blockerId", "blockedId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_discovery_user_blocks_pair"`);
    await queryRunner.query(`DROP INDEX "idx_discovery_user_blocks_blocked_id"`);
    await queryRunner.query(`DROP INDEX "idx_discovery_user_blocks_blocker_id"`);
    await queryRunner.query(`DROP TABLE "discovery_user_blocks"`);
  }
}
