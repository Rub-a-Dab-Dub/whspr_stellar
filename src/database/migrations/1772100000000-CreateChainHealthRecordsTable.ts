import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateChainHealthRecordsTable1772100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'chain_health_records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'chain',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['healthy', 'degraded', 'down'],
            isNullable: false,
          },
          {
            name: 'latencyMs',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'blockNumber',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'blockAge',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'paymasterBalance',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'paymasterBalanceWarning',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'checkedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          new TableIndex({ columnNames: ['chain', 'checkedAt'] }),
          new TableIndex({ columnNames: ['checkedAt'] }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('chain_health_records');
  }
}
