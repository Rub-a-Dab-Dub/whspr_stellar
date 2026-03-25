import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogSchema1711234567896 implements MigrationInterface {
  name = 'AuditLogSchema1711234567896';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actorId"    uuid,
        "targetId"   uuid,
        "action"     varchar(64) NOT NULL,
        "resource"   varchar(128) NOT NULL,
        "resourceId" uuid,
        "ipAddress"  varchar(45),
        "userAgent"  text,
        "metadata"   jsonb,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_audit_logs_actor_id"   ON "audit_logs"("actorId")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_target_id"  ON "audit_logs"("targetId")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_action"     ON "audit_logs"("action")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_resource"   ON "audit_logs"("resource")`);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("createdAt")`,
    );

    // Prevent any UPDATE or DELETE on audit_logs to enforce immutability.
    await queryRunner.query(`
      CREATE RULE "audit_logs_no_update" AS ON UPDATE TO "audit_logs" DO INSTEAD NOTHING
    `);
    await queryRunner.query(`
      CREATE RULE "audit_logs_no_delete" AS ON DELETE TO "audit_logs" DO INSTEAD NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP RULE IF EXISTS "audit_logs_no_delete" ON "audit_logs"`);
    await queryRunner.query(`DROP RULE IF EXISTS "audit_logs_no_update" ON "audit_logs"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_resource"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_target_id"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_actor_id"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
