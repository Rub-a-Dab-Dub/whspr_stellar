import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateNFTsTable1772100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'nfts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'contractAddress',
            type: 'varchar',
          },
          {
            name: 'tokenId',
            type: 'varchar',
          },
          {
            name: 'ownerId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'imageUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'collection',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'network',
            type: 'varchar',
            default: "'stellar'",
          },
          {
            name: 'lastSyncedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_NFTS_ASSET',
            columnNames: ['network', 'contractAddress', 'tokenId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'nfts',
      new TableIndex({
        name: 'IDX_NFTS_OWNER',
        columnNames: ['ownerId'],
      }),
    );

    await queryRunner.createIndex(
      'nfts',
      new TableIndex({
        name: 'IDX_NFTS_NETWORK',
        columnNames: ['network'],
      }),
    );

    await queryRunner.createForeignKey(
      'nfts',
      new TableForeignKey({
        columnNames: ['ownerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('nfts');
  }
}
