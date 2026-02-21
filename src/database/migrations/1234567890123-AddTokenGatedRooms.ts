import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class AddTokenGatedRooms1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to rooms table
    await queryRunner.query(`
      ALTER TABLE rooms 
      ADD COLUMN is_token_gated BOOLEAN DEFAULT FALSE,
      ADD COLUMN entry_fee DECIMAL(18, 8) DEFAULT 0,
      ADD COLUMN token_address VARCHAR(255),
      ADD COLUMN payment_required BOOLEAN DEFAULT FALSE,
      ADD COLUMN free_trial_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN free_trial_duration_hours INTEGER DEFAULT 24,
      ADD COLUMN access_duration_days INTEGER
    `);

    // Create room_payments table
    await queryRunner.createTable(
      new Table({
        name: 'room_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'room_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'platform_fee',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'creator_amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'transaction_hash',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'blockchain_network',
            type: 'varchar',
            default: "'ethereum'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'failed', 'refunded', 'expired'],
            default: "'pending'",
          },
          {
            name: 'access_granted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'access_expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'refund_transaction_hash',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'refunded_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'notes',
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
        ],
      }),
      true,
    );

    // Create user_room_access table
    await queryRunner.createTable(
      new Table({
        name: 'user_room_access',
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
          },
          {
            name: 'room_id',
            type: 'uuid',
          },
          {
            name: 'has_access',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_free_trial',
            type: 'boolean',
            default: false,
          },
          {
            name: 'access_expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'payment_id',
            type: 'uuid',
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

    // Add foreign keys
    await queryRunner.createForeignKey(
      'room_payments',
      new TableForeignKey({
        columnNames: ['room_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rooms',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'room_payments',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_room_access',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_room_access',
      new TableForeignKey({
        columnNames: ['room_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rooms',
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_user_room_access ON user_room_access(user_id, room_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_room_payments_status ON room_payments(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_room_payments_user ON room_payments(user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_room_access');
    await queryRunner.dropTable('room_payments');
    await queryRunner.query(`
      ALTER TABLE rooms 
      DROP COLUMN is_token_gated,
      DROP COLUMN entry_fee,
      DROP COLUMN token_address,
      DROP COLUMN payment_required,
      DROP COLUMN free_trial_enabled,
      DROP COLUMN free_trial_duration_hours,
      DROP COLUMN access_duration_days
    `);
  }
}
