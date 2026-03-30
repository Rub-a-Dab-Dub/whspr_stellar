import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateChangelogTables1772300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    /* --- enum types --- */
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE changelog_platform_enum AS ENUM ('ALL','WEB','IOS','ANDROID');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE changelog_type_enum AS ENUM ('FEATURE','BUGFIX','SECURITY','BREAKING');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* --- changelogs table --- */
    await queryRunner.createTable(
      new Table({
        name: 'changelogs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'version', type: 'varchar', length: '30' },
          { name: 'platform', type: 'changelog_platform_enum', default: `'ALL'` },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'highlights', type: 'jsonb', default: `'[]'` },
          { name: 'fullContent', type: 'text', isNullable: true },
          { name: 'type', type: 'changelog_type_enum' },
          { name: 'isPublished', type: 'boolean', default: false },
          { name: 'publishedAt', type: 'timestamp', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'changelogs',
      new TableIndex({ name: 'IDX_changelogs_version', columnNames: ['version'] }),
    );
    await queryRunner.createIndex(
      'changelogs',
      new TableIndex({ name: 'IDX_changelogs_publishedAt', columnNames: ['publishedAt'] }),
    );

    /* --- user_changelog_views table --- */
    await queryRunner.createTable(
      new Table({
        name: 'user_changelog_views',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'varchar' },
          { name: 'lastSeenVersion', type: 'varchar', isNullable: true },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'user_changelog_views',
      new TableIndex({
        name: 'IDX_user_changelog_views_userId',
        columnNames: ['userId'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_changelog_views', true);
    await queryRunner.dropTable('changelogs', true);
    await queryRunner.query('DROP TYPE IF EXISTS changelog_type_enum');
    await queryRunner.query('DROP TYPE IF EXISTS changelog_platform_enum');
  }
}
