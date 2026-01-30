import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateSystemConfigTables1769800000000 implements MigrationInterface {
  name = 'CreateSystemConfigTables1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'system_configs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'key',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'value',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isFeatureFlag',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
            isNullable: false,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'uuid',
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
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'system_config_versions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'configId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'key',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'value',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'system_config_audits',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'configId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'key',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'enum',
            enum: ['created', 'updated', 'rolled_back', 'kill_switch'],
            isNullable: false,
          },
          {
            name: 'oldValue',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'newValue',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'adminId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'system_configs',
      new Index('UQ_system_configs_key', ['key'], { isUnique: true }),
    );

    await queryRunner.createIndex(
      'system_config_versions',
      new Index('UQ_system_config_versions_config_version', ['configId', 'version'], {
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'system_config_audits',
      new Index('IDX_system_config_audits_config_created', ['configId', 'createdAt']),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('system_config_audits');
    await queryRunner.dropTable('system_config_versions');
    await queryRunner.dropTable('system_configs');
  }
}
