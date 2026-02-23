import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateWebhookDeliveriesTable1771800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhook_deliveries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'subscriptionId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'event',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'delivered', 'failed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'responseStatus',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'responseBody',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'attemptCount',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'lastAttemptAt',
            type: 'timestamp',
            isNullable: true,
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
            columnNames: ['subscriptionId'],
            referencedTableName: 'webhook_subscriptions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({ columnNames: ['subscriptionId', 'createdAt'] }),
          new TableIndex({ columnNames: ['status', 'createdAt'] }),
          new TableIndex({ columnNames: ['event', 'createdAt'] }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_deliveries');
  }
}
