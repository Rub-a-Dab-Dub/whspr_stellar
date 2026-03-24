import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711234567890 implements MigrationInterface {
  name = 'InitialSchema1711234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "wallet_address" varchar(42) NOT NULL UNIQUE,
        "username" varchar(50) UNIQUE,
        "email" varchar(255) UNIQUE,
        "xp" integer NOT NULL DEFAULT 0,
        "level" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create rooms table
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "description" text,
        "entry_fee" decimal(18, 8) DEFAULT 0,
        "is_private" boolean NOT NULL DEFAULT false,
        "creator_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_rooms_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "idx_users_wallet" ON "users"("wallet_address")`);
    await queryRunner.query(`CREATE INDEX "idx_users_username" ON "users"("username")`);
    await queryRunner.query(`CREATE INDEX "idx_rooms_creator" ON "rooms"("creator_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_rooms_creator"`);
    await queryRunner.query(`DROP INDEX "idx_users_username"`);
    await queryRunner.query(`DROP INDEX "idx_users_wallet"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
