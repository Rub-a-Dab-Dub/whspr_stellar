import { MigrationInterface, QueryRunner } from 'typeorm';

export class StellarEventsSchema1711234567892 implements MigrationInterface {
  name = 'StellarEventsSchema1711234567892';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contract_events" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "eventId"         varchar(64)  NOT NULL UNIQUE,
        "contractId"      varchar(64)  NOT NULL,
        "ledgerSequence"  bigint       NOT NULL,
        "eventIndex"      int          NOT NULL,
        "topic0"          varchar(64)  NOT NULL,
        "topic1"          varchar(128),
        "topic2"          varchar(128),
        "payload"         jsonb        NOT NULL,
        "rawValueXdr"     text         NOT NULL,
        "processed"       boolean      NOT NULL DEFAULT false,
        "indexedAt"       TIMESTAMP    NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_contract_events_contract_topic" ON "contract_events"("contractId", "topic0")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_contract_events_ledger" ON "contract_events"("ledgerSequence")`,
    );

    await queryRunner.query(`
      CREATE TABLE "indexer_cursors" (
        "contractId"  varchar(64) PRIMARY KEY,
        "lastLedger"  bigint      NOT NULL,
        "updatedAt"   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "indexer_cursors"`);
    await queryRunner.query(`DROP INDEX "idx_contract_events_ledger"`);
    await queryRunner.query(`DROP INDEX "idx_contract_events_contract_topic"`);
    await queryRunner.query(`DROP TABLE "contract_events"`);
  }
}
