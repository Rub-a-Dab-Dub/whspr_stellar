import { MigrationInterface, QueryRunner } from 'typeorm';

export class DidIntegration1781000000000 implements MigrationInterface {
  name = 'DidIntegration1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "did_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "did" character varying(255) NOT NULL,
        "didDocument" jsonb NOT NULL DEFAULT '{}',
        "method" character varying(32) NOT NULL,
        "isVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_did_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_did_records_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_did_records_did" ON "did_records" ("did")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_did_records_user_id" ON "did_records" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "verifiable_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "didId" uuid NOT NULL,
        "credentialType" character varying(128) NOT NULL,
        "issuer" character varying(255) NOT NULL,
        "credentialSubject" jsonb NOT NULL DEFAULT '{}',
        "proof" jsonb NOT NULL DEFAULT '{}',
        "issuedAt" TIMESTAMP NOT NULL,
        "expiresAt" TIMESTAMP,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "revokedAt" TIMESTAMP,
        "showOnProfile" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verifiable_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vc_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vc_did" FOREIGN KEY ("didId") REFERENCES "did_records"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_vc_user_id" ON "verifiable_credentials" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_vc_did_id" ON "verifiable_credentials" ("didId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_vc_issuer" ON "verifiable_credentials" ("issuer")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_vc_issuer"`);
    await queryRunner.query(`DROP INDEX "IDX_vc_did_id"`);
    await queryRunner.query(`DROP INDEX "IDX_vc_user_id"`);
    await queryRunner.query(`DROP TABLE "verifiable_credentials"`);
    await queryRunner.query(`DROP INDEX "IDX_did_records_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_did_records_did"`);
    await queryRunner.query(`DROP TABLE "did_records"`);
  }
}
