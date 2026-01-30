import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddAdvancedTransferFeatures1706500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create transfer_templates table
    await queryRunner.createTable(
      new Table({
        name: 'transfer_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'recipient_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'blockchain_network',
            type: 'varchar',
            default: "'stellar'",
          },
          {
            name: 'memo',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'use_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_used_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_favorite',
            type: 'boolean',
            default: false,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create scheduled_transfers table
    await queryRunner.createTable(
      new Table({
        name: 'scheduled_transfers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'sender_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'recipient_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'blockchain_network',
            type: 'varchar',
            default: "'stellar'",
          },
          {
            name: 'memo',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'scheduled_date',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'is_recurring',
            type: 'boolean',
            default: false,
          },
          {
            name: 'recurrence_frequency',
            type: 'enum',
            enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
            isNullable: true,
          },
          {
            name: 'recurrence_end_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_execution_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'execution_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'max_executions',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'executed', 'cancelled', 'failed'],
            default: "'pending'",
          },
          {
            name: 'last_transfer_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'executed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelled_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'cancellation_reason',
            type: 'text',
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create transfer_limits table
    await queryRunner.createTable(
      new Table({
        name: 'transfer_limits',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'period',
            type: 'enum',
            enum: ['daily', 'weekly', 'monthly'],
            isNullable: false,
          },
          {
            name: 'limit_amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'used_amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'transaction_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'max_transaction_count',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'period_start',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'period_end',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create transfer_disputes table
    await queryRunner.createTable(
      new Table({
        name: 'transfer_disputes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'transfer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'initiator_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'enum',
            enum: ['unauthorized', 'wrong_amount', 'wrong_recipient', 'not_received', 'duplicate', 'fraud', 'other'],
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'under_review', 'resolved', 'rejected', 'closed'],
            default: "'open'",
          },
          {
            name: 'resolution',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'resolved_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resolved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'evidence',
            type: 'text',
            isArray: true,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'transfer_templates',
      new TableIndex({
        name: 'IDX_TEMPLATES_USER_CREATED',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transfer_templates',
      new TableIndex({
        name: 'IDX_TEMPLATES_USER_NAME',
        columnNames: ['user_id', 'name'],
      }),
    );

    await queryRunner.createIndex(
      'scheduled_transfers',
      new TableIndex({
        name: 'IDX_SCHEDULED_SENDER_DATE',
        columnNames: ['sender_id', 'scheduled_date'],
      }),
    );

    await queryRunner.createIndex(
      'scheduled_transfers',
      new TableIndex({
        name: 'IDX_SCHEDULED_STATUS_DATE',
        columnNames: ['status', 'scheduled_date'],
      }),
    );

    await queryRunner.createIndex(
      'scheduled_transfers',
      new TableIndex({
        name: 'IDX_SCHEDULED_RECURRING_NEXT',
        columnNames: ['is_recurring', 'next_execution_date'],
      }),
    );

    await queryRunner.createIndex(
      'transfer_limits',
      new TableIndex({
        name: 'IDX_LIMITS_USER_PERIOD',
        columnNames: ['user_id', 'period'],
      }),
    );

    await queryRunner.createIndex(
      'transfer_disputes',
      new TableIndex({
        name: 'IDX_DISPUTES_TRANSFER_STATUS',
        columnNames: ['transfer_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'transfer_disputes',
      new TableIndex({
        name: 'IDX_DISPUTES_INITIATOR_CREATED',
        columnNames: ['initiator_id', 'created_at'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'transfer_templates',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'scheduled_transfers',
      new TableForeignKey({
        columnNames: ['sender_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'transfer_limits',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'transfer_disputes',
      new TableForeignKey({
        columnNames: ['transfer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'transfers',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'transfer_disputes',
      new TableForeignKey({
        columnNames: ['initiator_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const templatesTable = await queryRunner.getTable('transfer_templates');
    const scheduledTable = await queryRunner.getTable('scheduled_transfers');
    const limitsTable = await queryRunner.getTable('transfer_limits');
    const disputesTable = await queryRunner.getTable('transfer_disputes');

    if (templatesTable) {
      const fk = templatesTable.foreignKeys.find(fk => fk.columnNames.indexOf('user_id') !== -1);
      if (fk) await queryRunner.dropForeignKey('transfer_templates', fk);
    }

    if (scheduledTable) {
      const fk = scheduledTable.foreignKeys.find(fk => fk.columnNames.indexOf('sender_id') !== -1);
      if (fk) await queryRunner.dropForeignKey('scheduled_transfers', fk);
    }

    if (limitsTable) {
      const fk = limitsTable.foreignKeys.find(fk => fk.columnNames.indexOf('user_id') !== -1);
      if (fk) await queryRunner.dropForeignKey('transfer_limits', fk);
    }

    if (disputesTable) {
      const transferFk = disputesTable.foreignKeys.find(fk => fk.columnNames.indexOf('transfer_id') !== -1);
      const initiatorFk = disputesTable.foreignKeys.find(fk => fk.columnNames.indexOf('initiator_id') !== -1);
      if (transferFk) await queryRunner.dropForeignKey('transfer_disputes', transferFk);
      if (initiatorFk) await queryRunner.dropForeignKey('transfer_disputes', initiatorFk);
    }

    // Drop indexes
    await queryRunner.dropIndex('transfer_templates', 'IDX_TEMPLATES_USER_CREATED');
    await queryRunner.dropIndex('transfer_templates', 'IDX_TEMPLATES_USER_NAME');
    await queryRunner.dropIndex('scheduled_transfers', 'IDX_SCHEDULED_SENDER_DATE');
    await queryRunner.dropIndex('scheduled_transfers', 'IDX_SCHEDULED_STATUS_DATE');
    await queryRunner.dropIndex('scheduled_transfers', 'IDX_SCHEDULED_RECURRING_NEXT');
    await queryRunner.dropIndex('transfer_limits', 'IDX_LIMITS_USER_PERIOD');
    await queryRunner.dropIndex('transfer_disputes', 'IDX_DISPUTES_TRANSFER_STATUS');
    await queryRunner.dropIndex('transfer_disputes', 'IDX_DISPUTES_INITIATOR_CREATED');

    // Drop tables
    await queryRunner.dropTable('transfer_disputes');
    await queryRunner.dropTable('transfer_limits');
    await queryRunner.dropTable('scheduled_transfers');
    await queryRunner.dropTable('transfer_templates');
  }
}
