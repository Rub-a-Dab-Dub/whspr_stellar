import { MigrationInterface, QueryRunner } from 'typeorm';

export class LegalConsentSchema1735000000000 implements MigrationInterface {
  name = 'LegalConsentSchema1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "legal_document_type_enum" AS ENUM (
        'TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'COOKIE_POLICY'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "legal_document_status_enum" AS ENUM (
        'DRAFT', 'ACTIVE', 'ARCHIVED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "legal_documents" (
        "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type"        "legal_document_type_enum"   NOT NULL,
        "version"     varchar(20)                  NOT NULL,
        "content"     text                         NOT NULL,
        "title"       varchar(255),
        "summary"     varchar(500),
        "status"      "legal_document_status_enum" NOT NULL DEFAULT 'DRAFT',
        "publishedAt" TIMESTAMP,
        "publishedBy" uuid,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_consents" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"          uuid        NOT NULL,
        "documentId"      uuid        NOT NULL,
        "documentVersion" varchar(20) NOT NULL,
        "ipAddress"       varchar(45),
        "userAgent"       text,
        "acceptedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_consents_user_document" UNIQUE ("userId", "documentId"),
        CONSTRAINT "fk_user_consents_document"
          FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_legal_documents_type_status" ON "legal_documents"("type", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_legal_documents_type_version" ON "legal_documents"("type", "version")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_legal_documents_status" ON "legal_documents"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_consents_user_id" ON "user_consents"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_consents_document_id" ON "user_consents"("documentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_consents_document_id"`);
    await queryRunner.query(`DROP INDEX "idx_user_consents_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_legal_documents_status"`);
    await queryRunner.query(`DROP INDEX "idx_legal_documents_type_version"`);
    await queryRunner.query(`DROP INDEX "idx_legal_documents_type_status"`);
    await queryRunner.query(`DROP TABLE "user_consents"`);
    await queryRunner.query(`DROP TABLE "legal_documents"`);
    await queryRunner.query(`DROP TYPE "legal_document_status_enum"`);
    await queryRunner.query(`DROP TYPE "legal_document_type_enum"`);
  }
}
