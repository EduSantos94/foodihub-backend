import { initializeDatabase, closeDatabase } from './connection.js';

/**
 * Grants or revokes the platform administrator flag (manages global data such as categories).
 * This is deliberately a command line tool: the flag cannot be changed through the API.
 *
 *   npm run platform-admin -- someone@example.com
 *   npm run platform-admin -- someone@example.com --revoke
 */
// Like migrate.ts, defaults to a local database (inside Docker DB_HOST is already set)
process.env.DB_HOST ??= 'localhost';

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');

  if (!email || email.startsWith('--')) {
    console.error('Usage: npm run platform-admin -- <email> [--revoke]');
    process.exit(1);
  }

  const ds = await initializeDatabase();
  try {
    const rows = await ds.query(
      'UPDATE users SET is_platform_admin = $2, updated_at = NOW() WHERE email = $1 RETURNING email',
      [email, !revoke]
    );
    const updated = Array.isArray(rows[0]) ? rows[0] : rows;

    if (updated.length === 0) {
      console.error(`No user found with email ${email}`);
      process.exit(1);
    }
    console.log(`✓ ${email} is ${revoke ? 'no longer' : 'now'} a platform administrator`);
  } finally {
    await closeDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
