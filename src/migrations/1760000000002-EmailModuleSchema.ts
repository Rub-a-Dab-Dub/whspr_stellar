import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailModuleSchema1760000000002 implements MigrationInterface {
  name = 'EmailModuleSchema1760000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(40) NOT NULL,
        "to" varchar(320) NOT NULL,
        "subject" varchar(255) NOT NULL,
        "html" text NOT NULL,
        "text" text,
        "status" varchar(20) NOT NULL DEFAULT 'queued',
        "providerMessageId" varchar(120),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "failureReason" text,
        "attempts" integer NOT NULL DEFAULT 0,
        "sentAt" TIMESTAMP WITH TIME ZONE,
        "deliveredAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "email_unsubscribes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(320) NOT NULL UNIQUE,
        "reason" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_email_deliveries_type" ON "email_deliveries"("type")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_email_deliveries_to" ON "email_deliveries"("to")`);
    await queryRunner.query(
      `CREATE INDEX "idx_email_deliveries_status" ON "email_deliveries"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_email_unsubscribes_email" ON "email_unsubscribes"("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_email_unsubscribes_email"`);
    await queryRunner.query(`DROP INDEX "idx_email_deliveries_status"`);
    await queryRunner.query(`DROP INDEX "idx_email_deliveries_to"`);
    await queryRunner.query(`DROP INDEX "idx_email_deliveries_type"`);
    await queryRunner.query(`DROP TABLE "email_unsubscribes"`);
    await queryRunner.query(`DROP TABLE "email_deliveries"`);
  }
}
