import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateIpWhitelistTable1771627613658 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ip_whitelist',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'ipCidr',
            type: 'cidr',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'addedBy',
            type: 'uuid',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'ip_whitelist',
      new TableForeignKey({
        columnNames: ['addedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ip_whitelist');
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('addedBy') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('ip_whitelist', foreignKey);
    }
    await queryRunner.dropTable('ip_whitelist');
  }
}
