import { MigrationInterface, QueryRunner } from 'typeorm';

export class TwoFactorSecretsSchema1732700000000 implements MigrationInterface {
  name = 'TwoFactorSecretsSchema1732700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "two_factor_secrets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL UNIQUE,
        "secretEncrypted" text NOT NULL,
        "backupCodeHashes" jsonb NOT NULL DEFAULT '[]',
        "isEnabled" boolean NOT NULL DEFAULT false,
        "enabledAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_two_factor_secrets_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_two_factor_secrets_user_id" ON "two_factor_secrets" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_two_factor_secrets_user_id"`);
    await queryRunner.query(`DROP TABLE "two_factor_secrets"`);
  }
}
