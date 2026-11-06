'use strict';
const assert = require('node:assert/strict');
const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const file = 'artifacts/news-restart-probe.json';

async function main() {
  const login = await fetch(base + '/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin_portal', password: 'Admin@1234' }), signal: AbortSignal.timeout(15000),
  });
  assert.equal(login.status, 200);
  const { data: { token } } = await login.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  if (process.argv[2] === 'prepare') {
    const article = { judul: `Restart probe ${randomUUID()}`, isi: 'Berita ini harus tetap utuh sesudah migrasi ulang dan restart backend.' };
    const response = await fetch(base + '/api/v1/berita', { method: 'POST', headers, body: JSON.stringify(article), signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 201);
    const { data: { id } } = await response.json();
    mkdirSync('artifacts', { recursive: true });
    writeFileSync(file, JSON.stringify({ id, ...article }));
    console.log('Created news persistence probe (no token stored).');
  } else if (process.argv[2] === 'verify') {
    const article = JSON.parse(readFileSync(file, 'utf8'));
    const response = await fetch(`${base}/api/v1/berita/${article.id}`, { headers, signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.judul, article.judul);
    assert.equal(data.isi, article.isi);
    const deleted = await fetch(`${base}/api/v1/berita/${article.id}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(15000) });
    assert.equal(deleted.status, 200);
    console.log('News survived repeated migrations and backend restart; probe removed.');
  } else throw new Error('Expected prepare or verify');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
