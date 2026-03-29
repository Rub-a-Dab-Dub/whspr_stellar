import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveLocationSchema1775000000000 implements MigrationInterface {
  name = 'LiveLocationSchema1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "location_shares" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "conversationId" uuid NOT NULL,
        "latitude" decimal(10,7) NOT NULL,
        "longitude" decimal(10,7) NOT NULL,
        "accuracy" decimal(6,2) NULL,
        "duration" int NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastUpdatedAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_location_shares_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_location_shares_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_location_shares_conversation_id" ON "location_shares"("conversationId")`);
    await queryRunner.query(`CREATE INDEX "idx_location_shares_user_id" ON "location_shares"("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_location_shares_expires_at" ON "location_shares"("expiresAt")`);
    await queryRunner.query(`CREATE INDEX "idx_location_shares_is_active" ON "location_shares"("isActive")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_location_shares_is_active"`);
    await queryRunner.query(`DROP INDEX "idx_location_shares_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_location_shares_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_location_shares_conversation_id"`);
    await queryRunner.query(`DROP TABLE "location_shares"`);
  }
}
