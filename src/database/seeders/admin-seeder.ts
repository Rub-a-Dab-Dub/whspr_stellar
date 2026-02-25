import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import dataSource from '../data-source';

dotenv.config();

export const seedAdminUser = async (dataSource: DataSource) => {
  const userRepo = dataSource.getRepository('User');

  const adminExists = await userRepo.findOne({
    where: { email: 'admin@gaslessgossip.com' },
  });

  if (!adminExists) {
    await userRepo.save({
      email: 'admin@gaslessgossip.com',
      username: 'admin',
      isAdmin: true,
      walletAddress: process.env.ADMIN_WALLET_ADDRESS || null,
    });
    console.log('✅ Admin user created');
  } else {
    console.log('ℹ️  Admin user already exists');
  }
};

// Run seeder if executed directly
if (require.main === module) {
  dataSource
    .initialize()
    .then(async (ds) => {
      await seedAdminUser(ds);
      await ds.destroy();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

