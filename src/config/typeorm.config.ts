import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

export const typeOrmConfig = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  extra: {
    min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  },
});

// DataSource for TypeORM CLI
export default new DataSource(typeOrmConfig());
