import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateReportsTable1740494000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'reporter_id',
            type: 'uuid',
          },
          {
            name: 'target_type',
            type: 'enum',
            enum: ['MESSAGE', 'ROOM', 'USER'],
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
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'REVIEWED', 'DISMISSED'],
            default: "'PENDING'",
          },
          {
            name: 'reviewed_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'reports',
      new TableIndex({
        name: 'IDX_REPORTS_STATUS_CREATED',
        columnNames: ['status', 'created_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'reports',
      new TableForeignKey({
        columnNames: ['reporter_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'reports',
      new TableForeignKey({
        columnNames: ['reviewed_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reports');
  }
}
