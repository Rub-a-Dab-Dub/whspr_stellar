import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSessionsSchema1711234567894 implements MigrationInterface {
  name = 'UserSessionsSchema1711234567894';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "refreshTokenHash" varchar(255) NOT NULL,
        "deviceInfo" varchar(255) NOT NULL,
        "ipAddress" varchar(45),
        "userAgent" text,
        "lastActiveAt" TIMESTAMP NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        CONSTRAINT "fk_user_sessions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_refresh_token_hash" ON "user_sessions"("refreshTokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions"("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_sessions_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_user_sessions_refresh_token_hash"`);
    await queryRunner.query(`DROP INDEX "idx_user_sessions_user_id"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
  }
}
