import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateGroupEncryptionKeyTables1772400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    /* --- group_encryption_keys table --- */
    await queryRunner.createTable(
      new Table({
        name: 'group_encryption_keys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'groupId', type: 'varchar' },
          { name: 'keyVersion', type: 'int' },
          { name: 'keyMaterial', type: 'text' },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'group_encryption_keys',
      new TableIndex({
        name: 'IDX_gek_groupId_isActive',
        columnNames: ['groupId', 'isActive'],
      }),
    );

    /* --- member_key_bundles table --- */
    await queryRunner.createTable(
      new Table({
        name: 'member_key_bundles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'groupKeyId', type: 'uuid' },
          { name: 'memberId', type: 'varchar' },
          { name: 'encryptedGroupKey', type: 'text' },
          { name: 'deviceId', type: 'varchar', default: `'default'` },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'member_key_bundles',
      new TableForeignKey({
        name: 'FK_mkb_groupKeyId',
        columnNames: ['groupKeyId'],
        referencedTableName: 'group_encryption_keys',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'member_key_bundles',
      new TableIndex({
        name: 'IDX_mkb_groupKeyId_memberId',
        columnNames: ['groupKeyId', 'memberId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('member_key_bundles', true);
    await queryRunner.dropTable('group_encryption_keys', true);
  }
}
