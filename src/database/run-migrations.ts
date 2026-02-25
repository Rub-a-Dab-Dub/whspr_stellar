#!/usr/bin/env ts-node
import dataSource from './data-source';

dataSource
  .initialize()
  .then(async (ds) => {
    console.log('Running migrations...');
    await ds.runMigrations();
    console.log('✅ Migrations completed successfully');
    await ds.destroy();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
