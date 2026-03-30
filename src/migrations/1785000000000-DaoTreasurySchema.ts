import { MigrationInterface, QueryRunner } from 'typeorm';

export class DaoTreasurySchema1785000000000 implements MigrationInterface {
  name = 'DaoTreasurySchema1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dao_treasuries" (
        "id"            uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
        "groupId"       uuid          NOT NULL,
        "balance"       numeric(38,0) NOT NULL DEFAULT '0',
        "tokenAddress"  varchar(64)   NOT NULL,
        "lastSyncedAt"  TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "uq_dao_treasury_group_id" UNIQUE ("groupId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_dao_treasury_group_id" ON "dao_treasuries"("groupId")`,
    );

    await queryRunner.query(
      `CREATE TYPE "dao_proposal_status_enum" AS ENUM ('ACTIVE','PASSED','REJECTED','EXECUTED','EXPIRED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "dao_treasury_proposals" (
        "id"                uuid                      PRIMARY KEY DEFAULT uuid_generate_v4(),
        "treasuryId"        uuid                      NOT NULL,
        "proposerId"        uuid                      NOT NULL,
        "recipientAddress"  varchar(64)               NOT NULL,
        "amount"            numeric(38,0)             NOT NULL,
        "description"       text                      NOT NULL,
        "status"            dao_proposal_status_enum  NOT NULL DEFAULT 'ACTIVE',
        "quorumRequired"    int                       NOT NULL DEFAULT 2,
        "votesFor"          int                       NOT NULL DEFAULT 0,
        "votesAgainst"      int                       NOT NULL DEFAULT 0,
        "sorobanTxHash"     varchar(128)              NULL,
        "expiresAt"         TIMESTAMP                 NOT NULL,
        "createdAt"         TIMESTAMP                 NOT NULL DEFAULT now(),
        CONSTRAINT "fk_dao_proposal_treasury"
          FOREIGN KEY ("treasuryId") REFERENCES "dao_treasuries"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_dao_proposal_treasury_id" ON "dao_treasury_proposals"("treasuryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dao_proposal_status" ON "dao_treasury_proposals"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dao_proposal_expires_at" ON "dao_treasury_proposals"("expiresAt")`,
    );

    await queryRunner.query(
      `CREATE TYPE "dao_vote_choice_enum" AS ENUM ('FOR','AGAINST')`,
    );
    await queryRunner.query(`
      CREATE TABLE "dao_treasury_votes" (
        "id"          uuid                  PRIMARY KEY DEFAULT uuid_generate_v4(),
        "proposalId"  uuid                  NOT NULL,
        "voterId"     uuid                  NOT NULL,
        "vote"        dao_vote_choice_enum  NOT NULL,
        "castedAt"    TIMESTAMP             NOT NULL DEFAULT now(),
        CONSTRAINT "uq_dao_vote_proposal_voter" UNIQUE ("proposalId", "voterId"),
        CONSTRAINT "fk_dao_vote_proposal"
          FOREIGN KEY ("proposalId") REFERENCES "dao_treasury_proposals"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_dao_vote_proposal_id" ON "dao_treasury_votes"("proposalId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_dao_vote_proposal_id"`);
    await queryRunner.query(`DROP TABLE "dao_treasury_votes"`);
    await queryRunner.query(`DROP TYPE "dao_vote_choice_enum"`);

    await queryRunner.query(`DROP INDEX "idx_dao_proposal_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_dao_proposal_status"`);
    await queryRunner.query(`DROP INDEX "idx_dao_proposal_treasury_id"`);
    await queryRunner.query(`DROP TABLE "dao_treasury_proposals"`);
    await queryRunner.query(`DROP TYPE "dao_proposal_status_enum"`);

    await queryRunner.query(`DROP INDEX "idx_dao_treasury_group_id"`);
    await queryRunner.query(`DROP TABLE "dao_treasuries"`);
  }
}
