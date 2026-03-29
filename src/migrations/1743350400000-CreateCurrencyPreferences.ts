import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCurrencyPreferences1743350400000 implements MigrationInterface {
  name = 'CreateCurrencyPreferences1743350400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM type for display currencies
    await queryRunner.query(
      `CREATE TYPE "public"."currency_preferences_displaycurrency_enum" AS ENUM('NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP')`,
    );

    // Create currency_preferences table
    await queryRunner.query(
      `CREATE TABLE "public"."currency_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "displayCurrency" "public"."currency_preferences_displaycurrency_enum" NOT NULL DEFAULT 'USD',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_currency_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_currency_preferences_user_id" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "uq_currency_preferences_user_id" UNIQUE ("userId")
      )`,
    );

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "idx_currency_preferences_user_id" ON "public"."currency_preferences" ("userId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_currency_preferences_display_currency" ON "public"."currency_preferences" ("displayCurrency")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "public"."idx_currency_preferences_display_currency"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."idx_currency_preferences_user_id"`,
    );

    // Drop table
    await queryRunner.query(
      `DROP TABLE "public"."currency_preferences"`,
    );

    // Drop ENUM type
    await queryRunner.query(
      `DROP TYPE "public"."currency_preferences_displaycurrency_enum"`,
    );
  }
}
