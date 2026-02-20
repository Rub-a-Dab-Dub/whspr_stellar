import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePlatformConfigTable1769891578002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'platform_configs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'key',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'value',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Initial seed
    await queryRunner.query(`
      INSERT INTO platform_configs (key, value, description) VALUES
      ('maintenance_mode', 'false', 'Enable/disable platform maintenance mode'),
      ('registration_enabled', 'true', 'Enable/disable new user registrations'),
      ('tipping_enabled', 'true', 'Enable/disable tipping feature'),
      ('max_room_members', '100', 'Maximum number of members allowed in a room'),
      ('xp_multiplier', '1.0', 'Global XP multiplier for rewards')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('platform_configs');
  }
}
