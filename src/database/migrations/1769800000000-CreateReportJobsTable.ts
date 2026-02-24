import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateReportJobsTable1769800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'report_jobs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['revenue', 'users', 'transactions', 'rooms'],
            isNullable: false,
          },
          {
            name: 'format',
            type: 'enum',
            enum: ['csv', 'json'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'complete', 'failed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'startDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'endDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'requestedBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'filePath',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isScheduled',
            type: 'boolean',
            default: false,
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
      }),
      true,
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'report_jobs',
      new TableIndex({
        name: 'IDX_REPORT_JOBS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'report_jobs',
      new TableIndex({
        name: 'IDX_REPORT_JOBS_REQUESTED_BY',
        columnNames: ['requestedBy'],
      }),
    );

    await queryRunner.createIndex(
      'report_jobs',
      new TableIndex({
        name: 'IDX_REPORT_JOBS_EXPIRES_AT',
        columnNames: ['expiresAt'],
      }),
    );

    await queryRunner.createIndex(
      'report_jobs',
      new TableIndex({
        name: 'IDX_REPORT_JOBS_CREATED_AT',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('report_jobs');
  }
}
