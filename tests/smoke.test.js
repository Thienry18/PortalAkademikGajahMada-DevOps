'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';

async function request(path, { token, body } = {}) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, data: await response.json() };
}

test('gateway reaches the real database and serves frontend assets', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.database, 'connected');
  for (const path of ['/', '/css/login.css', '/pages/dashboard-admin.html', '/pages/dashboard-siswa.html', '/pages/dashboard-guru.html', '/pages/dashboard-ortu.html']) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length > 100, path);
  }
  const missing = await request('/api/v1/does-not-exist');
  assert.equal(missing.status, 404);
  assert.equal(missing.data.success, false);
});

test('protected APIs reject missing and forged tokens', async () => {
  assert.equal((await request('/api/v1/users')).status, 401);
  assert.equal((await request('/api/v1/auth/me', { token: 'forged-token' })).status, 401);
});

test('login rejects invalid credentials and validates required fields', async () => {
  assert.equal((await request('/api/v1/auth/login', { body: { username: 'admin_portal', password: 'incorrect' } })).status, 401);
  const missing = await request('/api/v1/auth/login', { body: {} });
  assert.ok([400, 422].includes(missing.status));
});

test('four roles can log in; student cannot access admin APIs', async () => {
  for (const [username, password, role] of [
    ['admin_portal', 'Admin@1234', 'admin'],
    ['guru_budi', 'Guru@1234', 'guru'],
    ['siswa_rizky', 'Siswa@1234', 'siswa'],
    ['ortu_ahmad', 'Ortu@1234', 'orang_tua'],
  ]) {
    const login = await request('/api/v1/auth/login', { body: { username, password } });
    assert.equal(login.status, 200, username);
    assert.equal(login.data.data.user.role, role);
    const token = login.data.data.token;
    assert.ok(token);
    const me = await request('/api/v1/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.data.data.username, username);
    assert.equal((await request('/api/v1/ekskul', { token })).status, 200);
    assert.equal((await request('/api/v1/pengumuman', { token })).status, 200);
    assert.equal((await request('/api/v1/users', { token })).status, role === 'admin' ? 200 : 403);
    if (role === 'siswa') {
      const grades = await request(`/api/v1/nilai/siswa/${login.data.data.user.profile.id}`, { token });
      assert.equal(grades.status, 200);
    }
  }
});
