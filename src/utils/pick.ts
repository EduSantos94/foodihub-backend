/**
 * Copies only the listed keys (and only when they are not undefined). Used on update endpoints so
 * the request body can never overwrite columns that are not meant to be edited (store_id, ...).
 */
export function pick<T extends object, K extends keyof T>(data: T | undefined | null, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  if (!data) return out;
  for (const key of keys) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}
