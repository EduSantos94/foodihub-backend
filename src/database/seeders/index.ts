import 'reflect-metadata';
import { initializeDatabase } from '../connection.js';
import { StoreModel } from '../models/StoreModel';
import { UserModel } from '../models/UserModel';
import { StoreSeed } from './StoreSeed';
import { UserSeed } from './UserSeed';

export async function runAllSeeds() {
  try {
    const AppDataSource = await initializeDatabase();

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
    // Connection is closed by initializeDatabase
  }
}

// Run if executed directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule || process.argv[1]?.endsWith('seeders/index.ts')) {
  runAllSeeds().catch(console.error);
}

export { StoreSeed, UserSeed };
