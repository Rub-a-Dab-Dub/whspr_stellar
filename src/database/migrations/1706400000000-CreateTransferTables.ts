import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateTransferTables1706400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create transfers table
    await queryRunner.createTable(
      new Table({
        name: 'transfers',
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
            name: 'transaction_hash',
            type: 'varchar',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['p2p', 'bulk'],
            default: "'p2p'",
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
            name: 'bulk_transfer_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sender_balance_before',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'sender_balance_after',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'recipient_balance_before',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'recipient_balance_after',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retry_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failed_at',
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create bulk_transfers table
    await queryRunner.createTable(
      new Table({
        name: 'bulk_transfers',
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
            name: 'total_recipients',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'successful_transfers',
            type: 'int',
            default: 0,
          },
          {
            name: 'failed_transfers',
            type: 'int',
            default: 0,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'partially_completed', 'failed'],
            default: "'pending'",
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
            name: 'completed_at',
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for transfers table
    await queryRunner.createIndex(
      'transfers',
      new TableIndex({
        name: 'IDX_TRANSFERS_SENDER_CREATED',
        columnNames: ['sender_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transfers',
      new TableIndex({
        name: 'IDX_TRANSFERS_RECIPIENT_CREATED',
        columnNames: ['recipient_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transfers',
      new TableIndex({
        name: 'IDX_TRANSFERS_STATUS_CREATED',
        columnNames: ['status', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transfers',
      new TableIndex({
        name: 'IDX_TRANSFERS_TRANSACTION_HASH',
        columnNames: ['transaction_hash'],
      }),
    );

    // Create indexes for bulk_transfers table
    await queryRunner.createIndex(
      'bulk_transfers',
      new TableIndex({
        name: 'IDX_BULK_TRANSFERS_SENDER_CREATED',
        columnNames: ['sender_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'bulk_transfers',
      new TableIndex({
        name: 'IDX_BULK_TRANSFERS_STATUS_CREATED',
        columnNames: ['status', 'created_at'],
      }),
    );

    // Create foreign keys for transfers table
    await queryRunner.createForeignKey(
      'transfers',
      new TableForeignKey({
        columnNames: ['sender_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'transfers',
      new TableForeignKey({
        columnNames: ['recipient_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // Create foreign key for bulk_transfers table
    await queryRunner.createForeignKey(
      'bulk_transfers',
      new TableForeignKey({
        columnNames: ['sender_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const transfersTable = await queryRunner.getTable('transfers');
    const bulkTransfersTable = await queryRunner.getTable('bulk_transfers');

    if (transfersTable) {
      const senderFk = transfersTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('sender_id') !== -1,
      );
      const recipientFk = transfersTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('recipient_id') !== -1,
      );
      if (senderFk) await queryRunner.dropForeignKey('transfers', senderFk);
      if (recipientFk) await queryRunner.dropForeignKey('transfers', recipientFk);
    }

    if (bulkTransfersTable) {
      const senderFk = bulkTransfersTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('sender_id') !== -1,
      );
      if (senderFk) await queryRunner.dropForeignKey('bulk_transfers', senderFk);
    }

    // Drop indexes
    await queryRunner.dropIndex('transfers', 'IDX_TRANSFERS_SENDER_CREATED');
    await queryRunner.dropIndex('transfers', 'IDX_TRANSFERS_RECIPIENT_CREATED');
    await queryRunner.dropIndex('transfers', 'IDX_TRANSFERS_STATUS_CREATED');
    await queryRunner.dropIndex('transfers', 'IDX_TRANSFERS_TRANSACTION_HASH');
    await queryRunner.dropIndex('bulk_transfers', 'IDX_BULK_TRANSFERS_SENDER_CREATED');
    await queryRunner.dropIndex('bulk_transfers', 'IDX_BULK_TRANSFERS_STATUS_CREATED');

    // Drop tables
    await queryRunner.dropTable('transfers');
    await queryRunner.dropTable('bulk_transfers');
  }
}
