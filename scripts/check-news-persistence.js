'use strict';
const assert = require('node:assert/strict');
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
async function main() {
  assert.ok(['prepare', 'verify'].includes(process.argv[2]));
  const response = await fetch(base + '/health', { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.database, 'connected');
  assert.deepEqual(health.features, []);
  const news = await fetch(base + '/api/v1/berita', { signal: AbortSignal.timeout(15000) });
  assert.equal(news.status, 404);
  console.log('Pre-Berita baseline verified; the workflow separately checks user counts across migration and restart.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
