import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePaymentsTable1769900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payments',
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
            isNullable: true,
          },
          {
            name: 'recipient_wallet_address',
            type: 'varchar',
            length: '56',
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
            name: 'token_address',
            type: 'varchar',
            length: '56',
            isNullable: true,
          },
          {
            name: 'transaction_hash',
            type: 'varchar',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['P2P', 'TIP'],
            default: "'P2P'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: "'pending'",
          },
          {
            name: 'failure_reason',
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
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_PAYMENTS_SENDER_CREATED',
        columnNames: ['sender_id', 'created_at'],
      }),
    );
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_PAYMENTS_RECIPIENT_CREATED',
        columnNames: ['recipient_id', 'created_at'],
      }),
    );
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_PAYMENTS_TRANSACTION_HASH',
        columnNames: ['transaction_hash'],
      }),
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['sender_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['recipient_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payments');
    if (table) {
      const senderFk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('sender_id') !== -1);
      const recipientFk = table.foreignKeys.find((fk) => fk.columnNames.indexOf('recipient_id') !== -1);
      if (senderFk) await queryRunner.dropForeignKey('payments', senderFk);
      if (recipientFk) await queryRunner.dropForeignKey('payments', recipientFk);
    }
    await queryRunner.dropIndex('payments', 'IDX_PAYMENTS_SENDER_CREATED');
    await queryRunner.dropIndex('payments', 'IDX_PAYMENTS_RECIPIENT_CREATED');
    await queryRunner.dropIndex('payments', 'IDX_PAYMENTS_TRANSACTION_HASH');
    await queryRunner.dropTable('payments');
  }
}
