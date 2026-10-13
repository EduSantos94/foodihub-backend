import { DataSource } from 'typeorm';
import { initializeDatabase, closeDatabase } from '../database/connection.js';

export const RUN = process.env.RUN_INTEGRATION === '1';

export interface TestStore {
  ds: DataSource;
  storeId: string;
  cleanup: () => Promise<void>;
}

/** Creates a throw-away store (tenant). cleanup() removes everything it created. */
export async function createTestStore(label: string): Promise<TestStore> {
  const ds = await initializeDatabase();
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@int-test.local`;
  // stores.document is unique and limited to 20 chars
  const document = String(Date.now()) + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const [store] = await ds.query(
    'INSERT INTO stores(name, email, document) VALUES ($1, $2, $3) RETURNING id',
    [`int-test ${label}`, email, document]
  );
  const storeId: string = store.id;

  return {
    ds,
    storeId,
    cleanup: async () => {
      // sale_items -> products is ON DELETE RESTRICT, so sales go first
      await ds.query('DELETE FROM sales WHERE store_id = $1', [storeId]);
      await ds.query('DELETE FROM stores WHERE id = $1', [storeId]);
      await closeDatabase();
    },
  };
}
