import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRewardsSystem1769335951000 implements MigrationInterface {
  name = 'CreateRewardsSystem1769335951000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create reward_type enum
    await queryRunner.query(`
      CREATE TYPE "public"."reward_type_enum" AS ENUM('xp_boost', 'premium_days', 'custom_badge')
    `);

    // Create user_reward_status enum
    await queryRunner.query(`
      CREATE TYPE "public"."user_reward_status_enum" AS ENUM('active', 'redeemed', 'expired', 'traded', 'gifted')
    `);

    // Create marketplace_listing_status enum
    await queryRunner.query(`
      CREATE TYPE "public"."marketplace_listing_status_enum" AS ENUM('active', 'sold', 'cancelled')
    `);

    // Create rewards table
    await queryRunner.query(`
      CREATE TABLE "rewards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."reward_type_enum" NOT NULL,
        "value" numeric(10,2) NOT NULL,
        "description" text,
        "name" character varying(255),
        "imageUrl" character varying(500),
        "stackLimit" integer NOT NULL DEFAULT '0',
        "expirationDays" integer,
        "isActive" boolean NOT NULL DEFAULT true,
        "isTradeable" boolean NOT NULL DEFAULT false,
        "isGiftable" boolean NOT NULL DEFAULT false,
        "isMarketplaceItem" boolean NOT NULL DEFAULT false,
        "marketplacePrice" numeric(10,2),
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rewards_id" PRIMARY KEY ("id")
      )
    `);

    // Create index on rewards type
    await queryRunner.query(`
      CREATE INDEX "IDX_rewards_type" ON "rewards" ("type")
    `);

    // Create user_rewards table
    await queryRunner.query(`
      CREATE TABLE "user_rewards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "rewardId" uuid NOT NULL,
        "status" "public"."user_reward_status_enum" NOT NULL DEFAULT 'active',
        "expiresAt" TIMESTAMP,
        "redeemedAt" TIMESTAMP,
        "tradedToUserId" uuid,
        "giftedToUserId" uuid,
        "grantedByUserId" uuid,
        "eventName" character varying(255),
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_rewards_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes on user_rewards
    await queryRunner.query(`
      CREATE INDEX "IDX_user_rewards_userId_status" ON "user_rewards" ("userId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_rewards_userId_expiresAt" ON "user_rewards" ("userId", "expiresAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_rewards_rewardId_status" ON "user_rewards" ("rewardId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_rewards_status" ON "user_rewards" ("status")
    `);

    // Create reward_marketplace table
    await queryRunner.query(`
      CREATE TABLE "reward_marketplace" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sellerId" uuid NOT NULL,
        "userRewardId" uuid NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "status" "public"."marketplace_listing_status_enum" NOT NULL DEFAULT 'active',
        "buyerId" uuid,
        "soldAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reward_marketplace_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes on reward_marketplace
    await queryRunner.query(`
      CREATE INDEX "IDX_reward_marketplace_sellerId_status" ON "reward_marketplace" ("sellerId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reward_marketplace_status_price" ON "reward_marketplace" ("status", "price")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_rewards" 
      ADD CONSTRAINT "FK_user_rewards_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_rewards" 
      ADD CONSTRAINT "FK_user_rewards_rewardId" 
      FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reward_marketplace" 
      ADD CONSTRAINT "FK_reward_marketplace_sellerId" 
      FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reward_marketplace" 
      ADD CONSTRAINT "FK_reward_marketplace_userRewardId" 
      FOREIGN KEY ("userRewardId") REFERENCES "user_rewards"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "reward_marketplace" 
      DROP CONSTRAINT "FK_reward_marketplace_userRewardId"
    `);

    await queryRunner.query(`
      ALTER TABLE "reward_marketplace" 
      DROP CONSTRAINT "FK_reward_marketplace_sellerId"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_rewards" 
      DROP CONSTRAINT "FK_user_rewards_rewardId"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_rewards" 
      DROP CONSTRAINT "FK_user_rewards_userId"
    `);

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reward_marketplace_status_price"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reward_marketplace_sellerId_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_rewards_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_rewards_rewardId_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_rewards_userId_expiresAt"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_rewards_userId_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_rewards_type"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "reward_marketplace"`);
    await queryRunner.query(`DROP TABLE "user_rewards"`);
    await queryRunner.query(`DROP TABLE "rewards"`);

    // Drop enums
    await queryRunner.query(
      `DROP TYPE "public"."marketplace_listing_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_reward_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reward_type_enum"`);
  }
}
