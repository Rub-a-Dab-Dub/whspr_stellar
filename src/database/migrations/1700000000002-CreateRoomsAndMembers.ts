import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoomsAndMembers1700000000002 implements MigrationInterface {
  name = 'CreateRoomsAndMembers1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."rooms_type_enum" AS ENUM('PUBLIC', 'PRIVATE', 'TOKEN_GATED', 'TIMED')
    `);
    
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "description" text,
        "type" "public"."rooms_type_enum" NOT NULL DEFAULT 'PUBLIC',
        "creator_id" uuid NOT NULL,
        "creator_wallet_address" character varying(56),
        "entryFee" numeric(18,8),
        "token_address" character varying(56),
        "max_members" integer DEFAULT 100,
        "expires_at" TIMESTAMP,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "room_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "room_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "transaction_hash" character varying,
        "paidAmount" numeric(18,8),
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_6e8e7c4c4b4b4b4b4b4b4b4b4b4b" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_user" UNIQUE ("room_id", "user_id"),
        CONSTRAINT "UQ_transaction_hash" UNIQUE ("transaction_hash")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_room_members_room_id_user_id" ON "room_members" ("room_id", "user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "rooms" ADD CONSTRAINT "FK_rooms_creator" 
      FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "room_members" ADD CONSTRAINT "FK_room_members_room" 
      FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "room_members" ADD CONSTRAINT "FK_room_members_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room_members" DROP CONSTRAINT "FK_room_members_user"`);
    await queryRunner.query(`ALTER TABLE "room_members" DROP CONSTRAINT "FK_room_members_room"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_creator"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_room_members_room_id_user_id"`);
    await queryRunner.query(`DROP TABLE "room_members"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TYPE "public"."rooms_type_enum"`);
  }
}