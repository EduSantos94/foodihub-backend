import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DataSource } from 'typeorm';
import { StoreModel } from './models/StoreModel.js';
import { UserModel } from './models/UserModel.js';
import { AuditLogModel } from './models/AuditLogModel.js';
import { ProductModel } from './models/ProductModel.js';
import { ProductSizeModel } from './models/ProductSizeModel.js';
import { CategoryModel } from './models/CategoryModel.js';
import { CustomerModel } from './models/CustomerModel.js';

/**
 * Migration Runner
 * Executa arquivos SQL do diretório migrations em ordem numérica.
 * Mantém controle das migrations já executadas na tabela _migrations.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'foodihub',
  synchronize: false,
  logging: false,
  entities: [StoreModel, UserModel, AuditLogModel, ProductModel, ProductSizeModel, CategoryModel, CustomerModel],
});

async function ensureMigrationsTable(queryRunner: any): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations(queryRunner: any): Promise<string[]> {
  const rows = await queryRunner.query(`SELECT filename FROM _migrations ORDER BY filename`);
  return rows.map((r: any) => r.filename);
}

async function markMigrationExecuted(queryRunner: any, filename: string): Promise<void> {
  await queryRunner.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [filename]);
}

async function runMigrations() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✓ Database connected');
    }

    const migrationsDir = path.join(__dirname, 'migrations');
    const allFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (allFiles.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // Garante que a tabela de controle existe
    await ensureMigrationsTable(queryRunner);

    // Filtra apenas as migrations ainda não executadas
    const executed = await getExecutedMigrations(queryRunner);
    const pending = allFiles.filter(f => !executed.includes(f));

    if (pending.length === 0) {
      console.log('\n✅ All migrations are already up to date.\n');
      await queryRunner.release();
      return;
    }

    console.log(`\n📦 Found ${pending.length} pending migration(s) (${allFiles.length} total)\n`);

    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`⏳ Running: ${file}`);
      try {
        await queryRunner.query(sql);
        await markMigrationExecuted(queryRunner, file);
        console.log(`✓ Completed: ${file}`);
      } catch (error) {
        console.error(`✗ Failed: ${file}`);
        console.error((error as Error).message);
        throw error;
      }
    }

    await queryRunner.release();
    console.log('\n✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

async function runMigrationsWithSeed() {
  try {
    await runMigrations();

    console.log('\n🌱 Running seeders...\n');
    const { runAllSeeds } = await import('./seeders/index.js');
    await runAllSeeds();

    console.log('✅ Migrations + seeders completed!\n');
  } catch (error) {
    console.error('❌ Process failed:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

if (command === 'seed') {
  runMigrationsWithSeed();
} else {
  runMigrations();
}
