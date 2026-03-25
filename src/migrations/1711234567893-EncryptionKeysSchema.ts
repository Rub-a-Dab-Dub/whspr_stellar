import { MigrationInterface, QueryRunner } from 'typeorm';

export class EncryptionKeysSchema1711234567893 implements MigrationInterface {
  name = 'EncryptionKeysSchema1711234567893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "key_type_enum" AS ENUM ('X25519', 'Ed25519')
    `);

    await queryRunner.query(`
      CREATE TABLE "encryption_keys" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"            uuid NOT NULL,
        "publicKey"         text NOT NULL,
        "keyType"           "key_type_enum" NOT NULL,
        "version"           integer NOT NULL DEFAULT 1,
        "isActive"          boolean NOT NULL DEFAULT true,
        "registeredOnChain" boolean NOT NULL DEFAULT false,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_encryption_keys_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_encryption_keys_user_id" ON "encryption_keys"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_encryption_keys_is_active" ON "encryption_keys"("isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_encryption_keys_user_active" ON "encryption_keys"("userId", "isActive")`,
    );

    await queryRunner.query(`
      CREATE TABLE "pre_key_bundles" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"           uuid NOT NULL,
        "encryptionKeyId"  uuid NOT NULL,
        "preKeys"          jsonb NOT NULL DEFAULT '[]',
        "isValid"          boolean NOT NULL DEFAULT true,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_pre_key_bundles_encryption_key"
          FOREIGN KEY ("encryptionKeyId") REFERENCES "encryption_keys"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_pre_key_bundles_user_id" ON "pre_key_bundles"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pre_key_bundles_user_valid" ON "pre_key_bundles"("userId", "isValid")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_pre_key_bundles_user_valid"`);
    await queryRunner.query(`DROP INDEX "idx_pre_key_bundles_user_id"`);
    await queryRunner.query(`DROP TABLE "pre_key_bundles"`);
    await queryRunner.query(`DROP INDEX "idx_encryption_keys_user_active"`);
    await queryRunner.query(`DROP INDEX "idx_encryption_keys_is_active"`);
    await queryRunner.query(`DROP INDEX "idx_encryption_keys_user_id"`);
    await queryRunner.query(`DROP TABLE "encryption_keys"`);
    await queryRunner.query(`DROP TYPE "key_type_enum"`);
  }
}
