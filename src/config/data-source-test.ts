import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Test database data source configuration.
 * Uses DATABASE_NAME_TEST env var which defaults to 'gasless_test'
 * This is used for e2e testing with a separate isolated database.
 */
export const testDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME_TEST || 'gasless_test',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const testDataSource = new DataSource(testDataSourceOptions);
export default testDataSource;
