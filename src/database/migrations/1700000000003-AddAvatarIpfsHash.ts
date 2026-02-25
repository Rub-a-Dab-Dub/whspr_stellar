import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarIpfsHash1700000000003 implements MigrationInterface {
  name = 'AddAvatarIpfsHash1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD "avatarIpfsHash" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarIpfsHash"`);
  }
}