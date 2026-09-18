import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { StoreModel } from './models/StoreModel.js';
import { UserModel } from './models/UserModel.js';
import { AuditLogModel } from './models/AuditLogModel.js';
import { ProductModel } from './models/ProductModel.js';
import { ProductSizeModel } from './models/ProductSizeModel.js';
import { CategoryModel } from './models/CategoryModel.js';
import { CustomerModel } from './models/CustomerModel.js';

export let AppDataSource: DataSource;

export async function createDataSource() {
  if (AppDataSource) {
    return AppDataSource;
  }

  AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'foodihub',
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    entities: [StoreModel, UserModel, AuditLogModel, ProductModel, ProductSizeModel, CategoryModel, CustomerModel],
    migrations: ['dist/database/migrations/**/*.js'],
    subscribers: ['dist/database/subscribers/**/*.js'],
  });

  return AppDataSource;
}

export async function initializeDatabase() {
  try {
    const ds = await createDataSource();
    if (!ds.isInitialized) {
      await ds.initialize();
      console.log('✓ Database connected successfully');
    }
    return ds;
  } catch (error) {
    console.error('✗ Error connecting to database:', error);
    throw error;
  }
}

export async function closeDatabase() {
  if (AppDataSource && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('✓ Database connection closed');
  }
}
