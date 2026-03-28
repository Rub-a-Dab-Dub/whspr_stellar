import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentRequestsSchema17250000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "requesterId" uuid NOT NULL,
        "payerId" uuid NOT NULL,
        "conversationId" uuid NOT NULL,
        "asset" varchar(12) NOT NULL,
        "amount" numeric(20,7) NOT NULL,
        "note" text,
        "status" varchar DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING','PAID','DECLINED','EXPIRED','CANCELLED')),
        "expiresAt" timestamp,
        "paidAt" timestamp,
        "transferId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_requests_conversation_id_status" ON "payment_requests" ("conversationId", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_requests_requester_id" ON "payment_requests" ("requesterId");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_requests_payer_id" ON "payment_requests" ("payerId");
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD CONSTRAINT "fk_payment_requests_requester" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD CONSTRAINT "fk_payment_requests_payer" FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD CONSTRAINT "fk_payment_requests_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD CONSTRAINT "fk_payment_requests_transfer" FOREIGN KEY ("transferId") REFERENCES "in_chat_transfers"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP CONSTRAINT "fk_payment_requests_transfer"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP CONSTRAINT "fk_payment_requests_conversation"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP CONSTRAINT "fk_payment_requests_payer"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP CONSTRAINT "fk_payment_requests_requester"`);
    await queryRunner.query(`DROP INDEX "idx_payment_requests_payer_id"`);
    await queryRunner.query(`DROP INDEX "idx_payment_requests_requester_id"`);
    await queryRunner.query(`DROP INDEX "idx_payment_requests_conversation_id_status"`);
    await queryRunner.query(`DROP TABLE "payment_requests"`);
  }
}
