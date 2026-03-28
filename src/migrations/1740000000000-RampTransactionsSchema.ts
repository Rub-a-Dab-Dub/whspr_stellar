import { MigrationInterface, QueryRunner } from 'typeorm';

export class RampTransactionsSchema1740000000000 implements MigrationInterface {
  name = 'RampTransactionsSchema1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "ramp_type_enum" AS ENUM ('DEPOSIT', 'WITHDRAWAL')
    `);
    await queryRunner.query(`
      CREATE TYPE "ramp_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED')
    `);
    await queryRunner.query(`
      CREATE TABLE "ramp_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" "ramp_type_enum" NOT NULL,
        "assetCode" varchar(12) NOT NULL,
        "amount" numeric(20, 7),
        "fiatAmount" numeric(20, 2),
        "fiatCurrency" varchar(3),
        "status" "ramp_status_enum" NOT NULL DEFAULT 'PENDING',
        "anchorId" varchar(255),
        "anchorUrl" text,
        "txHash" varchar(128),
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ramp_user_id" ON "ramp_transactions"("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_ramp_status" ON "ramp_transactions"("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_ramp_status"`);
    await queryRunner.query(`DROP INDEX "idx_ramp_user_id"`);
    await queryRunner.query(`DROP TABLE "ramp_transactions"`);
    await queryRunner.query(`DROP TYPE "ramp_status_enum"`);
    await queryRunner.query(`DROP TYPE "ramp_type_enum"`);
  }
}
