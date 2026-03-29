import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfessionalConnectionsSchema1775000000000 implements MigrationInterface {
  name = 'ProfessionalConnectionsSchema1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $migration$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'notification_type_enum' AND e.enumlabel = 'CONNECTION_REQUEST'
        ) THEN
          ALTER TYPE "notification_type_enum" ADD VALUE 'CONNECTION_REQUEST';
        END IF;
      END $migration$;
    `);

    await queryRunner.query(`
      CREATE TABLE "connection_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "senderId" uuid NOT NULL,
        "receiverId" uuid NOT NULL,
        "introMessage" character varying(300) NOT NULL,
        "status" character varying(32) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "respondedAt" TIMESTAMP,
        CONSTRAINT "PK_connection_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_connection_requests_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_connection_requests_receiver" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_connection_requests_pending_pair"
      ON "connection_requests" ("senderId", "receiverId")
      WHERE status = 'PENDING'
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_connection_requests_receiver_status" ON "connection_requests" ("receiverId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_connection_requests_sender_status" ON "connection_requests" ("senderId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE "professional_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userOneId" uuid NOT NULL,
        "userTwoId" uuid NOT NULL,
        "connectedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "mutualCount" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_professional_connections" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prof_connections_user_one" FOREIGN KEY ("userOneId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_prof_connections_user_two" FOREIGN KEY ("userTwoId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_prof_connections_canonical_order" CHECK (("userOneId")::text < ("userTwoId")::text)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_professional_connections_pair" ON "professional_connections" ("userOneId", "userTwoId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_prof_connections_user_one" ON "professional_connections" ("userOneId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_prof_connections_user_two" ON "professional_connections" ("userTwoId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_prof_connections_user_two"`);
    await queryRunner.query(`DROP INDEX "idx_prof_connections_user_one"`);
    await queryRunner.query(`DROP INDEX "ux_professional_connections_pair"`);
    await queryRunner.query(`DROP TABLE "professional_connections"`);

    await queryRunner.query(`DROP INDEX "idx_connection_requests_sender_status"`);
    await queryRunner.query(`DROP INDEX "idx_connection_requests_receiver_status"`);
    await queryRunner.query(`DROP INDEX "ux_connection_requests_pending_pair"`);
    await queryRunner.query(`DROP TABLE "connection_requests"`);

    // PostgreSQL cannot remove a single value from an enum safely; leave CONNECTION_REQUEST on the type.
  }
}
