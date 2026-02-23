import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSupportTicketsTable1772000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extend the audit_logs action enum
    for (const value of ['ticket.assigned', 'ticket.status.changed', 'ticket.resolved']) {
      await queryRunner.query(
        `ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'support_tickets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'subject',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['account', 'transaction', 'technical', 'abuse', 'other'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'in_progress', 'pending_user', 'resolved', 'closed'],
            default: "'open'",
            isNullable: false,
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'medium', 'high', 'urgent'],
            default: "'medium'",
            isNullable: false,
          },
          {
            name: 'assignedToId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: true,
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
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            columnNames: ['assignedToId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
        indices: [
          new TableIndex({ columnNames: ['status', 'createdAt'] }),
          new TableIndex({ columnNames: ['userId', 'createdAt'] }),
          new TableIndex({ columnNames: ['assignedToId', 'status'] }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('support_tickets');
  }
}
