import knex from 'knex';
import { Client } from 'pg';
import { services } from '../knexfile.js';

/**
 * Knex.js Multi-Service Database Manager
 * Handles:
 *  1. ensureDatabasesExist -> creates isolated DBs if they do not exist
 *  2. migrate              -> knex.migrate.latest()
 *  3. migrate:fresh        -> knex.migrate.rollback(null, true) then knex.migrate.latest()
 *  4. seed                 -> knex.seed.run()
 */

export async function ensureDatabasesExist() {
  const targetDatabases = new Set();
  let defaultConnStr = '';

  for (const [name, config] of Object.entries(services)) {
    if (typeof config.connection === 'string') {
      try {
        const parsed = new URL(config.connection);
        const dbName = parsed.pathname.replace(/^\//, '');
        if (dbName && dbName !== 'postgres') {
          targetDatabases.add(dbName);
        }
        parsed.pathname = '/postgres';
        defaultConnStr = parsed.toString();
      } catch {}
    }
  }

  const client = new Client({ connectionString: defaultConnStr });
  try {
    await client.connect();
    for (const db of targetDatabases) {
      const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
      if (res.rowCount === 0) {
        console.log(`  • [PostgreSQL] Database '${db}' does not exist. Creating...`);
        await client.query(`CREATE DATABASE "${db}"`);
        console.log(`  • [PostgreSQL] Created database '${db}'.`);
      }
    }
  } catch (err) {
    console.warn(`  [PostgreSQL Warning] Could not verify database existence:`, err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Run latest migrations on a specific service or all services.
 */
export async function runMigrate(targetService = null) {
  console.log('\n🚀 [Knex.js] Running Migrations (migrate:latest)...');
  await ensureDatabasesExist();
  const targetList = targetService ? [targetService] : Object.keys(services);

  for (const name of targetList) {
    const config = services[name];
    if (!config) {
      console.error(`[Knex.js Error] Unknown service: ${name}`);
      continue;
    }

    const db = knex(config);
    try {
      const [batchNo, log] = await db.migrate.latest();
      if (log.length === 0) {
        console.log(`  • [${name}-service] Already up to date (Batch ${batchNo})`);
      } else {
        console.log(`  • [${name}-service] Applied Batch ${batchNo}:`, log.join(', '));
      }
    } catch (err) {
      console.error(`  ✗ [${name}-service] Migration failed:`, err.message);
      throw err;
    } finally {
      await db.destroy();
    }
  }
  console.log('✅ [Knex.js] All migrations applied successfully!\n');
}

/**
 * Drop/rollback all tables and migrate fresh.
 */
export async function runMigrateFresh(targetService = null) {
  console.log('\n🔄 [Knex.js] Running Fresh Migrations (migrate:fresh)...');
  await ensureDatabasesExist();
  const targetList = targetService ? [targetService] : Object.keys(services);

  for (const name of targetList) {
    const config = services[name];
    if (!config) continue;

    const db = knex(config);
    try {
      // 1. Rollback all migration batches
      await db.migrate.rollback(null, true);
      console.log(`  • [${name}-service] Rolled back all previous tables`);

      // 2. Run migrations fresh
      const [batchNo, log] = await db.migrate.latest();
      console.log(`  • [${name}-service] Migrated fresh (Batch ${batchNo}):`, log.join(', '));
    } catch (err) {
      console.error(`  ✗ [${name}-service] Fresh migration failed:`, err.message);
      throw err;
    } finally {
      await db.destroy();
    }
  }
  console.log('✅ [Knex.js] Fresh migrations complete!\n');
}

/**
 * Insert seed data.
 */
export async function runSeed(targetService = null) {
  console.log('\n🌱 [Knex.js] Running Database Seeds (seed:run)...');
  const targetList = targetService ? [targetService] : Object.keys(services);

  for (const name of targetList) {
    const config = services[name];
    if (!config) continue;

    const db = knex(config);
    try {
      const [log] = await db.seed.run();
      if (log.length === 0) {
        console.log(`  • [${name}-service] No seeds found in directory`);
      } else {
        console.log(`  • [${name}-service] Seeded:`, log.join(', '));
      }
    } catch (err) {
      console.error(`  ✗ [${name}-service] Seed failed:`, err.message);
      throw err;
    } finally {
      await db.destroy();
    }
  }
  console.log('✅ [Knex.js] All seeds executed successfully!\n');
}

/**
 * CLI Entry Point
 */
async function main() {
  const command = process.argv[2] || 'migrate';
  const serviceArg = process.argv[3] || null;

  try {
    switch (command) {
      case 'migrate':
        await runMigrate(serviceArg);
        break;

      case 'migrate:fresh':
      case 'fresh':
        await runMigrateFresh(serviceArg);
        break;

      case 'seed':
      case 'seed:run':
        await runSeed(serviceArg);
        break;

      case 'reset':
      case 'fresh:seed':
        await runMigrateFresh(serviceArg);
        await runSeed(serviceArg);
        break;

      case 'seed:admin':
        await runSeed('auth');
        break;

      default:
        console.log(`Unknown Knex command: ${command}`);
        console.log('Available commands: migrate | migrate:fresh | seed | reset | seed:admin');
        process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal Knex.js Error:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('knexManager.js')) {
  main();
}
