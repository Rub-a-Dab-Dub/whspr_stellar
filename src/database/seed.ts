import { DataSource } from 'typeorm';
import { SeedService } from './seeds/seed-all.command';
import typeOrmConfig from '../config/typeorm.config';

async function runSeed() {
  console.log('Initializing database connection for seeding...');

  const dataSource = new DataSource(typeOrmConfig);

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    const seedService = new SeedService(dataSource);
    await seedService.seedAll();

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runSeed();
