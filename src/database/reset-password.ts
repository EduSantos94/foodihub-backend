import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { initializeDatabase, closeDatabase } from './connection.js';

/**
 * Sets a new password for a user, for when someone forgot theirs and there is no e-mail recovery yet.
 * Run it on the server; it prints the password, so hand it over safely and ask them to change it in
 * "Meu perfil".
 *
 *   npm run reset-password -- someone@example.com            (generates a password)
 *   npm run reset-password -- someone@example.com NewPass123  (uses the one given, 8+ characters)
 */
process.env.DB_HOST ??= 'localhost';

const MIN_LENGTH = 8;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const given = process.argv[3];

  if (!email || email.startsWith('--')) {
    console.error('Usage: npm run reset-password -- <email> [new-password]');
    process.exit(1);
  }
  if (given !== undefined && given.length < MIN_LENGTH) {
    console.error(`The password must have at least ${MIN_LENGTH} characters`);
    process.exit(1);
  }

  const password = given ?? randomBytes(9).toString('base64url'); // 12 URL-safe characters
  const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));

  const ds = await initializeDatabase();
  try {
    const rows = await ds.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE LOWER(email) = $1 RETURNING email', [email, hash]);
    const updated = Array.isArray(rows[0]) ? rows[0] : rows;

    if (updated.length === 0) {
      console.error(`No user found with email ${email}`);
      process.exit(1);
    }
    console.log(`✓ New password for ${email}: ${password}`);
  } finally {
    await closeDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
