// migrate.js - run SQL migrations against Turso/libSQL
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getEnv = () => {
  const url = process.env.PRIVATE_TURSO_DATABASE_URL || process.env.TURSO_CONNECTION_URL || process.env.PRIVATE_LIBSQL_DB_URL;
  const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.PRIVATE_LIBSQL_DB_API_TOKEN;
  return { url, authToken };
};

async function runMigrations() {
  const { url, authToken } = getEnv();

  if (!url) {
    console.error('Error: missing database URL');
    console.error('Set PRIVATE_TURSO_DATABASE_URL or TURSO_CONNECTION_URL.');
    process.exit(1);
  }

  console.log('Connecting to Turso...');
  console.log('URL:', url);

  const client = createClient({ url, authToken });

  try {
    await client.execute('SELECT 1');
    console.log('Connection OK\n');

    const migrationsDir = join(__dirname, 'drizzle', 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log('Migrations found:', files.length);

    for (const file of files) {
      console.log(`\nRunning: ${file}`);
      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf-8');

      const statements = content
        .split(/--> statement-breakpoint|-- statement-breakpoint/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          console.log(`  Statement ${i + 1}/${statements.length}...`);
          await client.execute(statement);
          console.log('  OK');
        } catch (err) {
          const message = err?.message || String(err);
          if (message.includes('already exists') || message.includes('duplicate column name')) {
            console.log('  Exists (skipped)');
          } else {
            console.error('  Error:', message);
            throw err;
          }
        }
      }

      console.log(`Done: ${file}`);
    }

    console.log('\nAll migrations completed successfully');
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigrations();
