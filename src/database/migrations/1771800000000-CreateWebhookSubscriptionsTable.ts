import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateWebhookSubscriptionsTable1771800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new webhook audit actions to the existing audit_logs action enum
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'webhook.created'
    `);
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'webhook.updated'
    `);
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'webhook.deleted'
    `);
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'webhook.tested'
    `);

    await queryRunner.createTable(
      new Table({
        name: 'webhook_subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'url',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'secret',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'events',
            type: 'simple-array',
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'consecutiveFailures',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'createdById',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['createdById'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
        indices: [
          new TableIndex({ columnNames: ['isActive', 'createdAt'] }),
          new TableIndex({ columnNames: ['createdById'] }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_subscriptions');
  }
}
