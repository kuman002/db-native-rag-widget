import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder });
  console.log('[Drizzle] Migrations applied successfully.');
}

// Support direct command line execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runMigrations()
    .then(async () => {
      console.log('All migrations applied successfully via Drizzle.');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Drizzle migration failed:', err);
      await pool.end();
      process.exit(1);
    });
}
