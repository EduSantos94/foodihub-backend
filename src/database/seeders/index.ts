import 'reflect-metadata';
import { AppDataSource } from '../connection.js';
import { StoreModel } from '../models/StoreModel';
import { UserModel } from '../models/UserModel';
import { StoreSeed } from './StoreSeed';
import { UserSeed } from './UserSeed';

export async function runAllSeeds() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Database connected successfully');
    }

    const storeRepository = AppDataSource.getRepository(StoreModel);
    const userRepository = AppDataSource.getRepository(UserModel);

    const storeSeed = new StoreSeed(storeRepository);
    const userSeed = new UserSeed(userRepository);

    console.log('\n=== Starting Seed Process ===\n');

    // Seed demo store
    console.log('→ Seeding Demo Store...');
    const demoStore = await storeSeed.seedDemoStore();

    // Seed users for demo store
    console.log('\n→ Seeding Demo Users...');
    await userSeed.seedDemoUsers(demoStore.id);

    // Seed test store
    console.log('\n→ Seeding Test Store...');
    const testStore = await storeSeed.seedTestStore();

    // Seed users for test store
    console.log('\n→ Seeding Test Users...');
    await userSeed.seedDemoUsers(testStore.id);

    console.log('\n=== Seed Process Completed Successfully ===\n');
  } catch (error) {
    console.error('Seed process failed:', error);
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  runAllSeeds();
}

export { StoreSeed, UserSeed };
