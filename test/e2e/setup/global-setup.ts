import './test-env';
import { Client } from 'pg';

export default async function globalSetup(): Promise<void> {
  const databaseName = process.env.DATABASE_NAME ?? 'gasless_gossip_test';
  const client = new Client({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 2000,
  });

  try {
    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[e2e] skipped database bootstrap: ${message}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}
