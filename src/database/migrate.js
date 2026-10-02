const fs = require('node:fs/promises');
const path = require('node:path');

require('dotenv').config({ quiet: true });

const pool = require('../config/database');
const logger = require('../config/logger');

const migrationsDirectory = path.join(__dirname, 'migrations');
const migrationLockName = 'hellha_schema_migrations';

const runMigrations = async () => {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [
      migrationLockName,
    ]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationFiles = (await fs.readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort();

    const appliedResult = await client.query(
      'SELECT filename FROM schema_migrations'
    );
    const appliedMigrations = new Set(
      appliedResult.rows.map((row) => row.filename)
    );

    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        logger.info({ migration: filename }, 'Migration already applied');
        continue;
      }

      const migrationPath = path.join(migrationsDirectory, filename);
      const migrationSql = await fs.readFile(migrationPath, 'utf8');

      await client.query('BEGIN');

      try {
        await client.query(migrationSql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        logger.info({ migration: filename }, 'Migration applied');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
      migrationLockName,
    ]);
    client.release();
  }
};

runMigrations()
  .then(() => {
    logger.info('Database migrations completed successfully');
  })
  .catch((error) => {
    logger.error({ err: error }, 'Database migration failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
