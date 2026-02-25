import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMessageMediaTable1769900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'message_media',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'wallet_address',
            type: 'varchar',
            length: '56',
            isNullable: false,
          },
          {
            name: 'ipfs_cid',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'content_hash',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'media_type',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'gateway_url',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'room_id',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'message_id',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'message_media',
      new TableIndex({
        name: 'IDX_MESSAGE_MEDIA_WALLET_CREATED',
        columnNames: ['wallet_address', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('message_media', 'IDX_MESSAGE_MEDIA_WALLET_CREATED');
    await queryRunner.dropTable('message_media');
  }
}
