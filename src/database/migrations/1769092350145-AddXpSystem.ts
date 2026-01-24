import { MigrationInterface, QueryRunner } from "typeorm";

export class AddXpSystem1769092350145 implements MigrationInterface {
    name = 'AddXpSystem1769092350145'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_772886e2f1f47b9ceb04a06e20"`);
        await queryRunner.query(`CREATE TYPE "public"."xp_history_action_enum" AS ENUM('MESSAGE_SENT', 'ROOM_CREATED', 'PROFILE_COMPLETED', 'AVATAR_UPLOADED', 'FRIEND_ADDED', 'REACTION_GIVEN', 'ROOM_JOINED', 'DAILY_LOGIN')`);
        await queryRunner.query(`CREATE TABLE "xp_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "amount" integer NOT NULL, "action" "public"."xp_history_action_enum" NOT NULL, "description" text, "levelBefore" integer NOT NULL DEFAULT '0', "levelAfter" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c4361b4eac7662c2e46cdb164d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_80584b6b884a9838de5f238141" ON "xp_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8eb6246bfe4637c90fe6874365" ON "xp_history" ("userId", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "walletAddress"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "connectionPrivacy"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaEnabled"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaSecret"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "displayName" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarCid" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarUrl" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "status" "public"."users_status_enum" NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`CREATE TYPE "public"."users_visibility_enum" AS ENUM('public', 'private', 'friends')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "visibility" "public"."users_visibility_enum" NOT NULL DEFAULT 'public'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "lastActiveAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "currentXp" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "level" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "isPremium" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "xpMultiplier" numeric(3,2) NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_49c5b098acf02a13f88d2017b0" ON "users" ("level") `);
        await queryRunner.query(`ALTER TABLE "xp_history" ADD CONSTRAINT "FK_80584b6b884a9838de5f238141a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "xp_history" DROP CONSTRAINT "FK_80584b6b884a9838de5f238141a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_49c5b098acf02a13f88d2017b0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "xpMultiplier"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isPremium"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "level"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "currentXp"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastActiveAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "visibility"`);
        await queryRunner.query(`DROP TYPE "public"."users_visibility_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarCid"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "displayName"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "mfaSecret" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "mfaEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "connectionPrivacy" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "walletAddress" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "password" character varying NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8eb6246bfe4637c90fe6874365"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_80584b6b884a9838de5f238141"`);
        await queryRunner.query(`DROP TABLE "xp_history"`);
        await queryRunner.query(`DROP TYPE "public"."xp_history_action_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_772886e2f1f47b9ceb04a06e20" ON "users" ("username", "email") `);
    }

}
