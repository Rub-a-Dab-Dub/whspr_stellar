import { DataSource } from 'typeorm';
import { testDataSourceOptions } from '../config/data-source-test';
import { seedTestDatabase } from './seeders/seed-test-db';

/**
 * Setup function for e2e tests
 * - Initializes test database connection
 * - Runs migrations
 * - Seeds test data
 */
export async function setupTestDatabase(): Promise<DataSource> {
  const dataSource = new DataSource(testDataSourceOptions);

  try {
    console.log('📦 Setting up test database...');

    // Connect to database
    await dataSource.initialize();
    console.log('✅ Connected to test database');

    // Run migrations
    console.log('🔄 Running migrations...');
    await dataSource.runMigrations();
    console.log('✅ Migrations completed');

    // Seed test data
    console.log('🌱 Seeding test data...');
    await seedTestDatabase(dataSource);
    console.log('✅ Test data seeded');

    return dataSource;
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    await dataSource.destroy().catch(() => {});
    throw error;
  }
}

/**
 * Teardown function for e2e tests
 * - Clears test data
 * - Closes database connection
 */
export async function teardownTestDatabase(
  dataSource: DataSource,
): Promise<void> {
  try {
    console.log('🧹 Cleaning up test database...');

    // Clear all data (preserve schema)
    const entities = dataSource.entityMetadatas;
    for (const entity of entities.reverse()) {
      const repository = dataSource.getRepository(entity.name);
      await repository.delete({});
    }

    console.log('✅ Test data cleared');

    // Close connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Test database teardown failed:', error);
    throw error;
  }
}

/**
 * Global test setup hook for Jest
 * This is called once before all test files run
 */
export async function globalSetup() {
  try {
    if (process.env.NODE_ENV === 'test') {
      console.log('\n🚀 Global test setup started...\n');

      const dataSource = await setupTestDatabase();

      // Store DataSource in global object for other tests to access
      (global as any).__test_db__ = dataSource;

      console.log('\n✨ Global test setup completed!\n');
    }
  } catch (error) {
    console.error('Global setup failed:', error);
    process.exit(1);
  }
}

/**
 * Global test teardown hook for Jest
 * This is called once after all test files complete
 */
async function globalTeardownFn() {
  try {
    if (process.env.NODE_ENV === 'test') {
      console.log('\n🧹 Global test teardown started...\n');

      const dataSource = (global as any).__test_db__;
      if (dataSource) {
        await teardownTestDatabase(dataSource);
      }

      console.log('\n✨ Global test teardown completed!\n');
    }
  } catch (error) {
    console.error('Global teardown failed:', error);
    process.exit(1);
  }
}

// Export for Jest to call
export default globalTeardownFn;
