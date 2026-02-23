import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddRoomSearchFeatures1771900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add category and tags columns to rooms table
    await queryRunner.query(`
      ALTER TABLE rooms
        ADD COLUMN IF NOT EXISTS "category" varchar NULL,
        ADD COLUMN IF NOT EXISTS "tags" text NULL
    `);

    // 2. Add GIN index on to_tsvector for full-text search on name + description
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_fts
        ON rooms
        USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')))
    `);

    // 3. Add index on category for fast filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_category
        ON rooms ("category")
        WHERE "isDeleted" = false AND "isActive" = true
    `);

    // 4. Add index on memberCount for popular/trending sort
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_member_count
        ON rooms ("memberCount" DESC)
        WHERE "isDeleted" = false AND "isActive" = true AND "isPrivate" = false
    `);

    // 5. Create room_search_analytics table
    await queryRunner.createTable(
      new Table({
        name: 'room_search_analytics',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'query',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resultCount',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'filters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          new TableIndex({ columnNames: ['userId', 'createdAt'] }),
          new TableIndex({ columnNames: ['createdAt'] }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('room_search_analytics');

    await queryRunner.query(`DROP INDEX IF EXISTS idx_rooms_fts`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rooms_category`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rooms_member_count`);

    await queryRunner.query(`
      ALTER TABLE rooms
        DROP COLUMN IF EXISTS "category",
        DROP COLUMN IF EXISTS "tags"
    `);
  }
}
