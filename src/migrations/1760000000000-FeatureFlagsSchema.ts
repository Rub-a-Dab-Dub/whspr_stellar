import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeatureFlagsSchema1760000000000 implements MigrationInterface {
  name = 'FeatureFlagsSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feature_flags" (
        "key" varchar(128) PRIMARY KEY,
        "isEnabled" boolean NOT NULL DEFAULT false,
        "rolloutPercentage" integer NOT NULL DEFAULT 0,
        "allowedUserIds" jsonb NOT NULL DEFAULT '[]',
        "allowedTiers" jsonb NOT NULL DEFAULT '[]',
        "description" text,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_feature_flags_is_enabled" ON "feature_flags"("isEnabled")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_feature_flags_is_enabled"`);
    await queryRunner.query(`DROP TABLE "feature_flags"`);
  }
}
