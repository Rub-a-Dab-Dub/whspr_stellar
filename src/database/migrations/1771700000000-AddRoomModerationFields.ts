import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddRoomModerationFields1771700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isClosed column
    await queryRunner.addColumn(
      'rooms',
      new TableColumn({
        name: 'isClosed',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    // Add closedAt column
    await queryRunner.addColumn(
      'rooms',
      new TableColumn({
        name: 'closedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    // Add closedBy column (user UUID who closed the room)
    await queryRunner.addColumn(
      'rooms',
      new TableColumn({
        name: 'closedBy',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add closeReason column
    await queryRunner.addColumn(
      'rooms',
      new TableColumn({
        name: 'closeReason',
        type: 'text',
        isNullable: true,
      }),
    );

    // Create indexes for room moderation queries
    await queryRunner.createIndex(
      'rooms',
      new TableIndex({
        name: 'IDX_rooms_isClosed',
        columnNames: ['isClosed'],
      }),
    );

    await queryRunner.createIndex(
      'rooms',
      new TableIndex({
        name: 'IDX_rooms_closedAt',
        columnNames: ['closedAt'],
      }),
    );

    await queryRunner.createIndex(
      'rooms',
      new TableIndex({
        name: 'IDX_rooms_isDeleted',
        columnNames: ['isDeleted'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('rooms', 'IDX_rooms_isDeleted');
    await queryRunner.dropIndex('rooms', 'IDX_rooms_closedAt');
    await queryRunner.dropIndex('rooms', 'IDX_rooms_isClosed');

    // Drop columns
    await queryRunner.dropColumn('rooms', 'closeReason');
    await queryRunner.dropColumn('rooms', 'closedBy');
    await queryRunner.dropColumn('rooms', 'closedAt');
    await queryRunner.dropColumn('rooms', 'isClosed');
  }
}
