import { DataSource, EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

/** Inserts the rows in chunks, using the given manager (so it can share a transaction with other writes). */
export async function insertChunks<T extends ObjectLiteral>(
  manager: EntityManager,
  target: EntityTarget<T>,
  rows: Record<string, unknown>[],
  chunkSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(target)
      .values(rows.slice(i, i + chunkSize) as any)
      .execute();
  }
}

/**
 * Inserts all rows or none: a database error rolls the whole import back. Rows go in chunks so a
 * big spreadsheet does not build one enormous statement.
 */
export async function bulkInsert<T extends ObjectLiteral>(
  ds: DataSource,
  target: EntityTarget<T>,
  rows: Record<string, unknown>[],
  chunkSize = 500
): Promise<void> {
  await ds.transaction((manager) => insertChunks(manager, target, rows, chunkSize));
}
