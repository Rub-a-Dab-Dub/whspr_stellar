import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePlatformConfig1740493902000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'platform_config',
        columns: [
          {
            name: 'key',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'value',
            type: 'jsonb',
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'varchar',
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

    // Insert default config values
    await queryRunner.query(`
      INSERT INTO platform_config (key, value, description) VALUES
      ('xp_multiplier', '1.0', 'XP multiplier for all activities'),
      ('platform_fee_percentage', '2.0', 'Platform fee percentage for tips and room entries'),
      ('allowed_reactions', '["👍","❤️","😂","😮","😢","🔥"]', 'Allowed emoji reactions'),
      ('rate_limit_messages_per_minute', '10', 'Rate limit for messages per user per minute'),
      ('feature_flags', '{"tipping":true,"rooms":true,"reactions":true}', 'Feature flags for platform features')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('platform_config');
  }
}
