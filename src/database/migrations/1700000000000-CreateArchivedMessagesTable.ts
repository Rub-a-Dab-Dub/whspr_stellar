import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateArchivedMessagesTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'archived_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'roomId',
            type: 'uuid',
          },
          {
            name: 'messageId',
            type: 'uuid',
          },
          {
            name: 'authorId',
            type: 'uuid',
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'originalCreatedAt',
            type: 'timestamp',
          },
          {
            name: 'archivedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'archived_messages',
      new TableIndex({
        name: 'IDX_archived_messages_room_archived',
        columnNames: ['roomId', 'archivedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('archived_messages');
  }
}
