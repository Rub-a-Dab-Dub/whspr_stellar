import { MigrationInterface, QueryRunner } from 'typeorm';

export class AMLEntities17460000000000 implements MigrationInterface {
  name = 'AMLEntities17460000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "aml_flag_type" AS ENUM('LARGE_AMOUNT', 'RAPID_SUCCESSION', 'STRUCTURING', 'UNUSUAL_PATTERN');
      CREATE TYPE "aml_risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      CREATE TYPE "aml_flag_status" AS ENUM('OPEN', 'REVIEWED', 'REPORTED', 'CLEARED');
      CREATE TYPE "compliance_report_type" AS ENUM('SAR', 'CTR');
    `);

    await queryRunner.query(`
      CREATE TABLE "compliance_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "period" varchar NOT NULL,
        "reportType" "compliance_report_type" NOT NULL,
        "transactionIds" jsonb NOT NULL,
        "totalAmount" numeric(38,18) NOT NULL,
        "pdfUrl" text,
        "submittedAt" timestamp,
        "generatedAt" timestamp NOT NULL,
        "updatedAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "aml_flags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "transactionId" uuid NOT NULL,
        "userId" uuid,
        "flagType" "aml_flag_type" NOT NULL,
        "riskLevel" "aml_risk_level" NOT NULL,
        "status" "aml_flag_status" NOT NULL DEFAULT 'OPEN',
        "reviewedBy" uuid,
        "reviewNotes" text,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_aml_flags_transaction" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_aml_flags_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_aml_flags_status" ON "aml_flags" ("status");
      CREATE INDEX "idx_aml_flags_user" ON "aml_flags" ("userId");
      CREATE INDEX "idx_aml_flags_transaction" ON "aml_flags" ("transactionId");
      CREATE INDEX "idx_aml_flags_created" ON "aml_flags" ("createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "aml_flags";`);
    await queryRunner.query(`DROP TABLE "compliance_reports";`);
    await queryRunner.query(`DROP TYPE "aml_flag_type" CASCADE;`);
    await queryRunner.query(`DROP TYPE "aml_risk_level" CASCADE;`);
    await queryRunner.query(`DROP TYPE "aml_flag_status" CASCADE;`);
    await queryRunner.query(`DROP TYPE "compliance_report_type" CASCADE;`);
  }
}

