import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSecurityAlertsTable1708519200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'security_alerts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'rule',
            type: 'varchar',
            enum: [
              'spam',
              'wash_trading',
              'early_withdrawal',
              'ip_registration_fraud',
              'admin_new_ip',
            ],
          },
          {
            name: 'severity',
            type: 'varchar',
            enum: ['low', 'medium', 'high', 'critical'],
          },
          {
            name: 'status',
            type: 'varchar',
            enum: ['open', 'acknowledged', 'resolved'],
            default: "'open'",
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'adminId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'acknowledgedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'idx_severity_status',
            columnNames: ['severity', 'status'],
          },
          {
            name: 'idx_rule',
            columnNames: ['rule'],
          },
          {
            name: 'idx_createdAt',
            columnNames: ['createdAt'],
          },
          {
            name: 'idx_userId',
            columnNames: ['userId'],
            where: '"userId" IS NOT NULL',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('security_alerts');
  }
}
