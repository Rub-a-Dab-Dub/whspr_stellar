import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateNotificationTables1769700000000 implements MigrationInterface {
  name = 'CreateNotificationTables1769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create notifications table
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'recipientId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'senderId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'message',
              'mention',
              'reply',
              'reaction',
              'room_invite',
              'room_join',
              'room_leave',
              'reward_granted',
              'level_up',
              'achievement',
              'system',
            ],
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'normal', 'high', 'urgent'],
            default: "'normal'",
            isNullable: false,
          },
          {
            name: 'isRead',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'readAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'actionUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'imageUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isDeleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'deletedAt',
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
      }),
      true,
    );

    // Create notification_preferences table
    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'message',
              'mention',
              'reply',
              'reaction',
              'room_invite',
              'room_join',
              'room_leave',
              'reward_granted',
              'level_up',
              'achievement',
              'system',
            ],
            isNullable: false,
          },
          {
            name: 'channel',
            type: 'enum',
            enum: ['in_app', 'push', 'email', 'sms'],
            isNullable: false,
          },
          {
            name: 'isEnabled',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'quietHoursStart',
            type: 'time',
            isNullable: true,
          },
          {
            name: 'quietHoursEnd',
            type: 'time',
            isNullable: true,
          },
          {
            name: 'mutedRooms',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'mutedUsers',
            type: 'text',
            isArray: true,
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
      }),
      true,
    );

    // Create push_subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'push_subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'endpoint',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'p256dhKey',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'authKey',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'deviceType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'deviceName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'lastUsedAt',
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
      }),
      true,
    );

    // Create indexes for notifications table
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_recipient_read_created',
        columnNames: ['recipientId', 'isRead', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_type_recipient',
        columnNames: ['type', 'recipientId'],
      }),
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_read_created',
        columnNames: ['isRead', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_expires_at',
        columnNames: ['expiresAt'],
      }),
    );

    // Create indexes for notification_preferences table
    await queryRunner.createIndex(
      'notification_preferences',
      new TableIndex({
        name: 'IDX_notification_preferences_user_type',
        columnNames: ['userId', 'type'],
      }),
    );

    // Create unique constraint for notification_preferences
    await queryRunner.createIndex(
      'notification_preferences',
      new TableIndex({
        name: 'UQ_notification_preferences_user_type_channel',
        columnNames: ['userId', 'type', 'channel'],
        isUnique: true,
      }),
    );

    // Create indexes for push_subscriptions table
    await queryRunner.createIndex(
      'push_subscriptions',
      new TableIndex({
        name: 'IDX_push_subscriptions_user_active',
        columnNames: ['userId', 'isActive'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['recipientId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['senderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'notification_preferences',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'push_subscriptions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const notificationsTable = await queryRunner.getTable('notifications');
    const notificationPreferencesTable = await queryRunner.getTable('notification_preferences');
    const pushSubscriptionsTable = await queryRunner.getTable('push_subscriptions');

    if (notificationsTable) {
      const recipientForeignKey = notificationsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('recipientId') !== -1,
      );
      const senderForeignKey = notificationsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('senderId') !== -1,
      );

      if (recipientForeignKey) {
        await queryRunner.dropForeignKey('notifications', recipientForeignKey);
      }
      if (senderForeignKey) {
        await queryRunner.dropForeignKey('notifications', senderForeignKey);
      }
    }

    if (notificationPreferencesTable) {
      const userForeignKey = notificationPreferencesTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('userId') !== -1,
      );
      if (userForeignKey) {
        await queryRunner.dropForeignKey('notification_preferences', userForeignKey);
      }
    }

    if (pushSubscriptionsTable) {
      const userForeignKey = pushSubscriptionsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('userId') !== -1,
      );
      if (userForeignKey) {
        await queryRunner.dropForeignKey('push_subscriptions', userForeignKey);
      }
    }

    // Drop tables
    await queryRunner.dropTable('push_subscriptions');
    await queryRunner.dropTable('notification_preferences');
    await queryRunner.dropTable('notifications');
  }
}
