'use strict';
const { readdir, readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { pool } = require('../src/config/db');

// Additive migrations work on both new databases and existing named volumes.
async function runMigrations() {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('portal_schema_migrations', 30) AS acquired");
    if (Number(lock.acquired) !== 1) throw new Error('Could not acquire migration lock');
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(190) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    const directory = join(__dirname, 'migrations');
    for (const name of (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort()) {
      const sql = await readFile(join(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const [[existing]] = await connection.query('SELECT checksum FROM schema_migrations WHERE name = ?', [name]);
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`Applied migration was modified: ${name}`);
        continue;
      }
      // Each migration is one idempotent DDL statement; MySQL DDL auto-commits.
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [name, checksum]);
      console.log(`Applied migration: ${name}`);
    }
  } finally {
    try { if (locked) await connection.query("SELECT RELEASE_LOCK('portal_schema_migrations')"); }
    finally { connection.release(); }
  }
}

module.exports = { runMigrations };
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  }).finally(() => pool.end());
}
