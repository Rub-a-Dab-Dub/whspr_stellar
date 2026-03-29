import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecurringPaymentTables1743400000000 implements MigrationInterface {
  name = 'CreateRecurringPaymentTables1743400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "recurring_payments_frequency_enum" AS ENUM ('DAILY','WEEKLY','BIWEEKLY','MONTHLY')
    `);
    await queryRunner.query(`
      CREATE TYPE "recurring_payments_status_enum" AS ENUM ('ACTIVE','PAUSED','CANCELLED','COMPLETED')
    `);
    await queryRunner.query(`
      CREATE TABLE "recurring_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "senderId" uuid NOT NULL,
        "recipientAddress" character varying(56) NOT NULL,
        "tokenId" uuid,
        "amount" numeric(20,7) NOT NULL,
        "frequency" "recurring_payments_frequency_enum" NOT NULL,
        "nextRunAt" TIMESTAMP NOT NULL,
        "lastRunAt" TIMESTAMP,
        "totalRuns" integer NOT NULL DEFAULT 0,
        "maxRuns" integer,
        "consecutiveFailures" integer NOT NULL DEFAULT 0,
        "status" "recurring_payments_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rp_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_rp_sender_id" ON "recurring_payments" ("senderId")`);
    await queryRunner.query(`CREATE INDEX "idx_rp_next_run_at" ON "recurring_payments" ("nextRunAt")`);
    await queryRunner.query(`CREATE INDEX "idx_rp_status" ON "recurring_payments" ("status")`);

    await queryRunner.query(`
      CREATE TYPE "recurring_payment_runs_status_enum" AS ENUM ('SUCCESS','FAILED','SKIPPED')
    `);
    await queryRunner.query(`
      CREATE TABLE "recurring_payment_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recurringPaymentId" uuid NOT NULL,
        "txHash" character varying(128),
        "status" "recurring_payment_runs_status_enum" NOT NULL,
        "amount" numeric(20,7) NOT NULL,
        "errorMessage" text,
        "executedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_payment_runs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rpr_recurring_payment" FOREIGN KEY ("recurringPaymentId")
          REFERENCES "recurring_payments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_rpr_recurring_payment_id" ON "recurring_payment_runs" ("recurringPaymentId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recurring_payment_runs"`);
    await queryRunner.query(`DROP TYPE "recurring_payment_runs_status_enum"`);
    await queryRunner.query(`DROP TABLE "recurring_payments"`);
    await queryRunner.query(`DROP TYPE "recurring_payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "recurring_payments_frequency_enum"`);
  }
}
