'use strict';

const { spawnSync } = require('node:child_process');
const { pool } = require('../../src/config/db');

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM users');
  if (Number(count) === 0 && process.env.SEED_DEMO_DATA === 'true') {
    const seed = spawnSync(process.execPath, ['database/seed.js'], { stdio: 'inherit' });
    if (seed.status !== 0) throw new Error('Database seeding failed');
  }
  require('../../server');
}

start().catch(async (error) => {
  console.error('Backend startup failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});
