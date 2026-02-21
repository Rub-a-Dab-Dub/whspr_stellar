import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddMessageTypesAndRoomFields1705967200001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add type column
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'type',
        type: 'enum',
        enum: ['text', 'image', 'file', 'tip', 'system'],
        default: "'text'",
        isNullable: false,
      }),
    );

    // Add roomId column
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'roomId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add mediaUrl column
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'mediaUrl',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Add fileName column
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'fileName',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Create indexes for room queries
    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'IDX_messages_roomId_createdAt',
        columnNames: ['roomId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'IDX_messages_type_roomId',
        columnNames: ['type', 'roomId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('messages', 'IDX_messages_type_roomId');
    await queryRunner.dropIndex('messages', 'IDX_messages_roomId_createdAt');

    // Drop columns
    await queryRunner.dropColumn('messages', 'fileName');
    await queryRunner.dropColumn('messages', 'mediaUrl');
    await queryRunner.dropColumn('messages', 'roomId');
    await queryRunner.dropColumn('messages', 'type');
  }
}
