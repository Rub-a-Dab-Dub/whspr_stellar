import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateXpBoostEventsTable1772200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'xp_boost.created'
    `);
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'xp_boost.updated'
    `);
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'xp_boost.deleted'
    `);
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'xp_boost.activated'
    `);
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum"
        ADD VALUE IF NOT EXISTS 'xp_boost.deactivated'
    `);

    await queryRunner.createTable(
      new Table({
        name: 'xp_boost_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'multiplier',
            type: 'decimal',
            precision: 4,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'appliesToActions',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'startAt',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'endAt',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'createdById',
            type: 'uuid',
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
            isNullable: false,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['createdById'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
        indices: [
          new TableIndex({ columnNames: ['isActive', 'startAt', 'endAt'] }),
          new TableIndex({ columnNames: ['isActive'] }),
          new TableIndex({ columnNames: ['createdById'] }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('xp_boost_events');
  }
}
