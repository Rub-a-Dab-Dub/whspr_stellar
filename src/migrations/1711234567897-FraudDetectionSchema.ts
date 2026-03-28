import { MigrationInterface, QueryRunner } from 'typeorm';

export class FraudDetectionSchema1711234567897 implements MigrationInterface {
  name = 'FraudDetectionSchema1711234567897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "login_action_enum" AS ENUM ('ALLOWED', 'CHALLENGED', 'BLOCKED')
    `);

    await queryRunner.query(`
      CREATE TABLE "login_attempts" (
        "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"      uuid,
        "ipAddress"   varchar(45) NOT NULL,
        "country"     varchar(100),
        "countryCode" varchar(10),
        "city"        varchar(100),
        "isVPN"       boolean NOT NULL DEFAULT false,
        "isTor"       boolean NOT NULL DEFAULT false,
        "isSuspicious" boolean NOT NULL DEFAULT false,
        "riskScore"   int NOT NULL DEFAULT 0,
        "action"      "login_action_enum" NOT NULL DEFAULT 'ALLOWED',
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_login_attempts_user_id"    ON "login_attempts"("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_login_attempts_ip"         ON "login_attempts"("ipAddress")`);
    await queryRunner.query(`CREATE INDEX "idx_login_attempts_created_at" ON "login_attempts"("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_login_attempts_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_login_attempts_ip"`);
    await queryRunner.query(`DROP INDEX "idx_login_attempts_user_id"`);
    await queryRunner.query(`DROP TABLE "login_attempts"`);
    await queryRunner.query(`DROP TYPE "login_action_enum"`);
  }
}
