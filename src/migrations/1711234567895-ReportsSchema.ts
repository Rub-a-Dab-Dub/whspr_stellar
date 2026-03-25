import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportsSchema1711234567895 implements MigrationInterface {
  name = 'ReportsSchema1711234567895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."reports_targettype_enum" AS ENUM('USER', 'MESSAGE', 'GROUP')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."reports_status_enum" AS ENUM('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED')
    `);
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "reporterId" uuid NOT NULL,
        "targetType" "public"."reports_targettype_enum" NOT NULL,
        "targetId" uuid NOT NULL,
        "reason" varchar(120) NOT NULL,
        "description" text,
        "status" "public"."reports_status_enum" NOT NULL DEFAULT 'PENDING',
        "reviewedBy" uuid,
        "reviewedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_reports_reporter"
          FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_reports_target_type_target_id" ON "reports"("targetType", "targetId")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_reports_status" ON "reports"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_reports_created_at" ON "reports"("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_reports_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_reports_status"`);
    await queryRunner.query(`DROP INDEX "idx_reports_target_type_target_id"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_targettype_enum"`);
  }
}
