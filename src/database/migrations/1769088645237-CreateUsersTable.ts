import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1769088645237 implements MigrationInterface {
  name = 'CreateUsersTable1769088645237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_772886e2f1f47b9ceb04a06e20"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "walletAddress"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "connectionPrivacy"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaSecret"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "displayName" character varying(100)`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatarCid" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatarUrl" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "status" "public"."users_status_enum" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_visibility_enum" AS ENUM('public', 'private', 'friends')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "visibility" "public"."users_visibility_enum" NOT NULL DEFAULT 'public'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "lastActiveAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "username" character varying(50) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "username" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastActiveAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "visibility"`);
    await queryRunner.query(`DROP TYPE "public"."users_visibility_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarCid"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "displayName"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "mfaSecret" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "mfaEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "connectionPrivacy" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "walletAddress" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_772886e2f1f47b9ceb04a06e20" ON "users" ("username", "email") `,
    );
  }
}
