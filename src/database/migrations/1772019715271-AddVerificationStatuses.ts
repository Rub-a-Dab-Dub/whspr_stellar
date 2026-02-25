import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerificationStatuses1772019715271 implements MigrationInterface {
    name = 'AddVerificationStatuses1772019715271'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying, "email" character varying, "walletAddress" character varying, "isBanned" boolean NOT NULL DEFAULT false, "suspendedUntil" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc71cd6fb73f95244b23e2ef11" ON "users" ("walletAddress") `);
        await queryRunner.query(`CREATE TYPE "public"."payments_type_enum" AS ENUM('P2P', 'TIP')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'processing', 'completed', 'verified', 'failed', 'refunded')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender_id" uuid NOT NULL, "recipient_id" uuid, "recipient_wallet_address" character varying(56) NOT NULL, "amount" numeric(18,8) NOT NULL, "token_address" character varying(56), "transaction_hash" character varying, "type" "public"."payments_type_enum" NOT NULL DEFAULT 'P2P', "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "failure_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP, CONSTRAINT "UQ_f134f5e71529e5f8c46014de074" UNIQUE ("transaction_hash"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f134f5e71529e5f8c46014de07" ON "payments" ("transaction_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_cf1e3a3a46758c4dbd7bb6f5b2" ON "payments" ("recipient_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_84696816c9bbe986349133679a" ON "payments" ("sender_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "message_media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "wallet_address" character varying(56) NOT NULL, "ipfs_cid" character varying(128) NOT NULL, "content_hash" character varying(64) NOT NULL, "media_type" character varying(32) NOT NULL, "gateway_url" text NOT NULL, "room_id" bigint, "message_id" bigint, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d3846d3e3d5fd07241e1aebff5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c453b7002643d85b37108a5355" ON "message_media" ("wallet_address", "created_at") `);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_4b02836bd57e578c437257dda58" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_0192ca7ba9de2d626df14aa4b24" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_0192ca7ba9de2d626df14aa4b24"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_4b02836bd57e578c437257dda58"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c453b7002643d85b37108a5355"`);
        await queryRunner.query(`DROP TABLE "message_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_84696816c9bbe986349133679a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf1e3a3a46758c4dbd7bb6f5b2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f134f5e71529e5f8c46014de07"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc71cd6fb73f95244b23e2ef11"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
