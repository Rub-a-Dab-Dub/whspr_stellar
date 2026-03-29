import { MigrationInterface, QueryRunner } from 'typeorm';

export class BulkPaymentsTables1745000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE bulk_payment_status AS ENUM ('pending', 'processing', 'completed', 'partial_failure');
      CREATE TYPE bulk_payment_row_status AS ENUM ('pending', 'success', 'failed');
    `);

    await queryRunner.query(`
      CREATE TABLE "bulk_payments" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "initiatedById" uuid NOT NULL,
        "label" varchar(100) NOT NULL,
        "csvKey" varchar(255) NOT NULL,
        "totalRows" integer NOT NULL,
        "successCount" integer DEFAULT 0,
        "failureCount" integer DEFAULT 0,
        "totalAmountUsdc" varchar NOT NULL,
        "status" bulk_payment_status DEFAULT 'pending' NOT NULL,
        "createdAt" timestamp DEFAULT NOW(),
        "pinVerifiedAt" timestamp,
        "completedAt" timestamp
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "bulk_payment_rows" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "bulkPaymentId" uuid NOT NULL REFERENCES bulk_payments(id) ON DELETE CASCADE,
        "rowNumber" integer NOT NULL,
        "toUsername" varchar NOT NULL,
        "amountUsdc" varchar NOT NULL,
        "note" varchar,
        "status" bulk_payment_row_status DEFAULT 'pending' NOT NULL,
        "failureReason" varchar,
        "txId" varchar,
        "processedAt" timestamp
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_bulk_payments_initiated_by" ON bulk_payments("initiatedById");
      CREATE INDEX "idx_bulk_payments_status" ON bulk_payments("status");
      CREATE INDEX "idx_bulk_payment_rows_bulk_payment" ON bulk_payment_rows("bulkPaymentId");
      CREATE INDEX "idx_bulk_payment_rows_status" ON bulk_payment_rows("status");
      CREATE UNIQUE INDEX "idx_bulk_payment_rows_unique" ON bulk_payment_rows("bulkPaymentId", "rowNumber");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bulk_payment_rows;`);
    await queryRunner.query(`DROP TABLE bulk_payments;`);
    await queryRunner.query(`DROP TYPE bulk_payment_status;`);
    await queryRunner.query(`DROP TYPE bulk_payment_row_status;`);
  }
}

