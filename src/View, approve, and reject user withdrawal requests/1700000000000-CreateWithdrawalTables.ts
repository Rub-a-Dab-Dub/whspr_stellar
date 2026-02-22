import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWithdrawalTables1700000000000 implements MigrationInterface {
  name = 'CreateWithdrawalTables1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "chain_type_enum" AS ENUM ('ETH', 'BSC', 'POLYGON', 'SOL', 'BTC')
    `);

    await queryRunner.query(`
      CREATE TYPE "withdrawal_status_enum" AS ENUM (
        'pending', 'approved', 'rejected', 'queued', 'completed'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "audit_action_enum" AS ENUM (
        'APPROVED', 'REJECTED', 'AUTO_APPROVED', 'QUEUED'
      )
    `);

    // Withdrawal requests table
    await queryRunner.query(`
      CREATE TABLE "withdrawal_requests" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"          VARCHAR NOT NULL,
        "username"         VARCHAR NOT NULL,
        "wallet_address"   VARCHAR NOT NULL,
        "amount"           DECIMAL(20, 8) NOT NULL,
        "chain"            "chain_type_enum" NOT NULL,
        "status"           "withdrawal_status_enum" NOT NULL DEFAULT 'pending',
        "risk_score"       FLOAT NOT NULL DEFAULT 0,
        "rejection_reason" TEXT,
        "reviewed_by"      VARCHAR,
        "reviewed_at"      TIMESTAMP,
        "is_new_address"   BOOLEAN NOT NULL DEFAULT FALSE,
        "auto_approved"    BOOLEAN NOT NULL DEFAULT FALSE,
        "tx_hash"          VARCHAR,
        "requested_at"     TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Audit logs table
    await queryRunner.query(`
      CREATE TABLE "withdrawal_audit_logs" (
        "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "withdrawal_request_id"   UUID NOT NULL REFERENCES withdrawal_requests(id),
        "admin_id"                VARCHAR,
        "admin_username"          VARCHAR,
        "action"                  "audit_action_enum" NOT NULL,
        "reason"                  TEXT,
        "metadata"                JSONB,
        "ip_address"              VARCHAR,
        "created_at"              TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX idx_wr_status ON withdrawal_requests(status);
      CREATE INDEX idx_wr_user_id ON withdrawal_requests(user_id);
      CREATE INDEX idx_wr_requested_at ON withdrawal_requests(requested_at);
      CREATE INDEX idx_wal_withdrawal_id ON withdrawal_audit_logs(withdrawal_request_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "withdrawal_audit_logs"`);
    await queryRunner.query(`DROP TABLE "withdrawal_requests"`);
    await queryRunner.query(`DROP TYPE "audit_action_enum"`);
    await queryRunner.query(`DROP TYPE "withdrawal_status_enum"`);
    await queryRunner.query(`DROP TYPE "chain_type_enum"`);
  }
}
