import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DataSource } from 'typeorm';
import { StoreModel } from './models/StoreModel.js';
import { UserModel } from './models/UserModel.js';
import { AuditLogModel } from './models/AuditLogModel.js';

/**
 * Migration Runner
 * Executa arquivos SQL do diretório migrations em ordem numérica
 * 
 * Uso:
 *   npm run migrate       # Executa todas as migrations
 *   npm run migrate:seed  # Executa migrations + seeders
 */

// Definir __dirname para módulos ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create DataSource directly
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'foodihub',
  synchronize: false,
  logging: false,
  entities: [StoreModel, UserModel, AuditLogModel],
  migrations: ['src/database/migrations/**/*.ts'],
  subscribers: ['src/database/subscribers/**/*.ts'],
});

async function runMigrations() {
  try {
    // Inicializar conexão
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✓ Database connected');
    }

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ordem numérica automática

    if (files.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }

    console.log(`\n📦 Found ${files.length} migration(s)\n`);

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`⏳ Running: ${file}`);
      try {
        await queryRunner.query(sql);
        console.log(`✓ Completed: ${file}\n`);
      } catch (error) {
        console.error(`✗ Failed: ${file}`);
        console.error((error as Error).message);
        throw error;
      }
    }

    await queryRunner.release();
    console.log('✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

/**
 * Executar migrations + seeders
 */
async function runMigrationsWithSeed() {
  try {
    // Rodar migrations
    await runMigrations();

    // Executar seeders
    console.log('\n🌱 Running seeders...\n');
    const { runAllSeeds } = await import('./seeders/index.js');
    await runAllSeeds();

    console.log('✅ Migrations completed!\n');
  } catch (error) {
    console.error('❌ Process failed:', error);
    process.exit(1);
  }
}

// Determinar qual comando executar
const command = process.argv[2];

if (command === 'seed') {
  runMigrationsWithSeed();
} else {
  runMigrations();
}
