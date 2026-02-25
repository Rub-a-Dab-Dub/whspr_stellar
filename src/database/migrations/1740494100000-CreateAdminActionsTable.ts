import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateAdminActionsTable1740494100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_actions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'admin_id',
            type: 'uuid',
          },
          {
            name: 'action_type',
            type: 'enum',
            enum: ['BAN_USER', 'REMOVE_ROOM', 'REVIEW_REPORT'],
          },
          {
            name: 'target_id',
            type: 'varchar',
          },
          {
            name: 'reason',
            type: 'text',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'admin_actions',
      new TableIndex({
        name: 'IDX_ADMIN_ACTIONS_ADMIN_CREATED',
        columnNames: ['admin_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'admin_actions',
      new TableIndex({
        name: 'IDX_ADMIN_ACTIONS_TYPE_CREATED',
        columnNames: ['action_type', 'created_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'admin_actions',
      new TableForeignKey({
        columnNames: ['admin_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('admin_actions');
  }
}
