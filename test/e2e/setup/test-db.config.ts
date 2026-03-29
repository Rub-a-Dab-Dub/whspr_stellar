import { DataSourceOptions } from 'typeorm';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/** Nested legacy module trees duplicate canonical entities; skip them for TypeORM metadata. */
const SKIP_DIR_NAMES = new Set([
  'Conversation Module',
  'message module',
  'Contact & Friends Module',
  'Push Notification Module',
  'Fee Estimation Module',
]);

function collectEntityPaths(rootDir: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      const full = join(dir, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (/\.entity\.(ts|js)$/.test(name)) {
        results.push(full);
      }
    }
  };
  walk(rootDir);
  return results;
}

const srcRoot = join(__dirname, '..', '..', '..', 'src');

export const testDbConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'gasless_gossip_test',
  entities: collectEntityPaths(srcRoot),
  synchronize: true,
  dropSchema: false,
  logging: false,
  extra: {
    connectionTimeoutMillis: 2000,
  },
};
