import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiChainSupport1769600000000 implements MigrationInterface {
  name = 'AddMultiChainSupport1769600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add preferred_chain column to users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD "preferred_chain" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "preferred_chain"`,
    );
  }
}
