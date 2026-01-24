import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddMessagesAndEditHistory1705967200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create messages table
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'conversationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'authorId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'originalContent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isEdited',
            type: 'boolean',
            default: false,
          },
          {
            name: 'editedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isDeleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'isHardDeleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create message_edit_history table
    await queryRunner.createTable(
      new Table({
        name: 'message_edit_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'messageId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'previousContent',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'newContent',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'editedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'IDX_messages_conversationId_createdAt',
        columnNames: ['conversationId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'IDX_messages_authorId_createdAt',
        columnNames: ['authorId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'IDX_messages_isDeleted_conversationId',
        columnNames: ['isDeleted', 'conversationId'],
      }),
    );

    await queryRunner.createIndex(
      'message_edit_history',
      new TableIndex({
        name: 'IDX_message_edit_history_messageId',
        columnNames: ['messageId'],
      }),
    );

    // Create foreign key constraint for messages.authorId -> users.id
    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        columnNames: ['authorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create foreign key constraint for message_edit_history.messageId -> messages.id
    await queryRunner.createForeignKey(
      'message_edit_history',
      new TableForeignKey({
        columnNames: ['messageId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'messages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const messageTable = await queryRunner.getTable('messages');
    const messageEditHistoryTable = await queryRunner.getTable(
      'message_edit_history',
    );

    if (messageTable) {
      const authorForeignKey = messageTable.foreignKeys.find(
        (fk) => fk.columnNames[0] === 'authorId',
      );
      if (authorForeignKey) {
        await queryRunner.dropForeignKey('messages', authorForeignKey);
      }
    }

    if (messageEditHistoryTable) {
      const messageForeignKey = messageEditHistoryTable.foreignKeys.find(
        (fk) => fk.columnNames[0] === 'messageId',
      );
      if (messageForeignKey) {
        await queryRunner.dropForeignKey(
          'message_edit_history',
          messageForeignKey,
        );
      }
    }

    // Drop indexes
    await queryRunner.dropIndex(
      'messages',
      'IDX_messages_conversationId_createdAt',
    );
    await queryRunner.dropIndex('messages', 'IDX_messages_authorId_createdAt');
    await queryRunner.dropIndex(
      'messages',
      'IDX_messages_isDeleted_conversationId',
    );
    await queryRunner.dropIndex(
      'message_edit_history',
      'IDX_message_edit_history_messageId',
    );

    // Drop tables
    await queryRunner.dropTable('message_edit_history');
    await queryRunner.dropTable('messages');
  }
}
