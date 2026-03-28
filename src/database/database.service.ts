import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

export interface MigrationInfo {
  name: string;
  appliedAt: Date | null;
  status: 'applied' | 'pending';
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('Database service initialized');
  }

  /**
   * Get list of all migrations (applied and pending)
   */
  async getMigrations(): Promise<MigrationInfo[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Check if migrations table exists
      const tableExists = await queryRunner.hasTable('migrations');

      if (!tableExists) {
        this.logger.warn('Migrations table does not exist');
        return [];
      }

      // Get applied migrations
      const appliedMigrations = await queryRunner.query(
        'SELECT "name", "timestamp" FROM "migrations" ORDER BY "timestamp"',
      );

      const appliedMap = new Map<string, Date>();
      for (const row of appliedMigrations) {
        appliedMap.set(row.name, new Date(row.timestamp));
      }

      // Get migration files from filesystem
      const fs = await import('fs');
      const path = await import('path');

      const migrationsDir = path.join(__dirname, '..', 'migrations');
      let migrationFiles: string[] = [];

      try {
        migrationFiles = fs.readdirSync(migrationsDir).filter((f) =>
          f.endsWith('.ts') || f.endsWith('.js'),
        );
      } catch (error) {
        this.logger.warn(`Could not read migrations directory: ${error}`);
      }

      const allMigrations: MigrationInfo[] = [];

      for (const file of migrationFiles) {
        const className = file.replace(/\.(ts|js)$/, '');
        const appliedAt = appliedMap.get(className) || null;

        allMigrations.push({
          name: className,
          appliedAt,
          status: appliedAt ? 'applied' : 'pending',
        });
      }

      // Sort by migration name (which includes timestamp prefix)
      allMigrations.sort((a, b) => a.name.localeCompare(b.name));

      return allMigrations;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    tableCount: number;
    totalRows: number;
    databaseSize: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Get table count
      const tableCountResult = await queryRunner.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      const tableCount = parseInt(tableCountResult[0].count, 10);

      // Get total row count across all tables (approximate)
      const totalRowsResult = await queryRunner.query(`
        SELECT SUM(n_live_tup) as total_rows
        FROM pg_stat_user_tables
      `);
      const totalRows = parseInt(totalRowsResult[0].total_rows || '0', 10);

      // Get database size
      const sizeResult = await queryRunner.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      const databaseSize = sizeResult[0].size;

      return {
        tableCount,
        totalRows,
        databaseSize,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Run health check on database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }
}
