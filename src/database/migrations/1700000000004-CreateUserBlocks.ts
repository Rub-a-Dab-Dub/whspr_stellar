import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserBlocks1700000000004 implements MigrationInterface {
  name = 'CreateUserBlocks1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "blocker_id" uuid NOT NULL,
        "blocked_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_blocker_blocked" UNIQUE ("blocker_id", "blocked_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_blocks_blocked_id" ON "user_blocks" ("blocked_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_user_blocks_blocker" 
      FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_user_blocks_blocked" 
      FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_user_blocks_blocked"`);
    await queryRunner.query(`ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_user_blocks_blocker"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_blocks_blocked_id"`);
    await queryRunner.query(`DROP TABLE "user_blocks"`);
  }
}