'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const logins = new Map();

async function request(path, { token, body, method } = {}) {
  const response = await fetch(base + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, data: await response.json() };
}

async function login(username, password) {
  if (!logins.has(username)) {
    logins.set(username, request('/api/v1/auth/login', { body: { username, password } }).then(result => {
      assert.equal(result.status, 200, username);
      return result;
    }));
  }
  return logins.get(username);
}

test('gateway reaches the real database and serves frontend assets', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.database, 'connected');
  assert.ok(health.data.features.includes('berita'));
  for (const path of ['/', '/css/login.css', '/pages/berita.html', '/css/berita.css', '/js/berita.js', '/pages/dashboard-admin.html', '/pages/dashboard-siswa.html', '/pages/dashboard-guru.html', '/pages/dashboard-ortu.html']) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, path);
    const content = await response.text();
    assert.ok(content.length > 100, path);
    if (path.startsWith('/pages/dashboard-')) assert.ok(content.includes('href="/pages/berita.html"'), path);
  }
  const missing = await request('/api/v1/does-not-exist');
  assert.equal(missing.status, 404);
  assert.equal(missing.data.success, false);
});

test('protected APIs reject missing and forged tokens', async () => {
  assert.equal((await request('/api/v1/users')).status, 401);
  assert.equal((await request('/api/v1/berita')).status, 401);
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
    const session = await login(username, password);
    assert.equal(session.data.data.user.role, role);
    const token = session.data.data.token;
    assert.ok(token);
    const me = await request('/api/v1/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.data.data.username, username);
    assert.equal((await request('/api/v1/ekskul', { token })).status, 200);
    assert.equal((await request('/api/v1/pengumuman', { token })).status, 200);
    assert.equal((await request('/api/v1/users', { token })).status, role === 'admin' ? 200 : 403);
    if (role === 'siswa') {
      const grades = await request(`/api/v1/nilai/siswa/${session.data.data.user.profile.id}`, { token });
      assert.equal(grades.status, 200);
    }
  }
});

test('Berita CRUD enforces author ownership and readers cannot write', async t => {
  const admin = (await login('admin_portal', 'Admin@1234')).data.data;
  const guru = (await login('guru_budi', 'Guru@1234')).data.data;
  const otherGuru = (await login('guru_siti', 'Guru@5678')).data.data;
  const student = (await login('siswa_rizky', 'Siswa@1234')).data.data;
  const parent = (await login('ortu_ahmad', 'Ortu@1234')).data.data;
  const ids = [];
  t.after(async () => {
    for (const id of ids) await request(`/api/v1/berita/${id}`, { token: admin.token, method: 'DELETE' });
  });
  const article = { judul: `Berita CI ${randomUUID()}`, ringkasan: 'Prestasi siswa Gajah Mada', isi: '<script>window.newsInjected=true</script> Teks ini harus tetap ditampilkan sebagai teks biasa.', penulis_id: admin.user.id };
  const created = await request('/api/v1/berita', { token: guru.token, body: article });
  assert.equal(created.status, 201);
  const id = created.data.data.id;
  ids.push(id);
  const path = `/api/v1/berita/${id}`;
  for (const reader of [student, parent]) {
    const detail = await request(path, { token: reader.token });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.data.isi, article.isi);
    assert.equal(Number(detail.data.data.penulis_id), guru.user.id, 'author comes from the verified token');
    assert.equal((await request('/api/v1/berita', { token: reader.token, body: article })).status, 403);
    assert.equal((await request(path, { token: reader.token, body: article, method: 'PUT' })).status, 403);
    assert.equal((await request(path, { token: reader.token, method: 'DELETE' })).status, 403);
  }
  assert.equal((await request(path, { token: otherGuru.token, body: article, method: 'PUT' })).status, 403);
  assert.equal((await request(path, { token: otherGuru.token, method: 'DELETE' })).status, 403);
  const edited = { ...article, judul: article.judul + ' diperbarui' };
  assert.equal((await request(path, { token: guru.token, body: edited, method: 'PUT' })).status, 200);
  assert.equal((await request(path, { token: student.token })).data.data.judul, edited.judul);
  assert.equal((await request(path, { token: admin.token, body: article, method: 'PUT' })).status, 200);
  assert.equal((await request(path, { token: admin.token, method: 'DELETE' })).status, 200);
  assert.equal((await request(path, { token: student.token })).status, 404);
  const own = await request('/api/v1/berita', { token: guru.token, body: article });
  assert.equal(own.status, 201);
  ids.push(own.data.data.id);
  assert.equal((await request(`/api/v1/berita/${own.data.data.id}`, { token: guru.token, method: 'DELETE' })).status, 200);
});

test('Berita validates fields, IDs, and pagination bounds', async () => {
  const { token } = (await login('admin_portal', 'Admin@1234')).data.data;
  const article = { judul: 'Berita validasi', isi: 'Isi berita untuk pemeriksaan validasi.' };
  for (const body of [{}, { ...article, judul: 'a' }, { ...article, isi: '' }, { ...article, judul: {} }, { ...article, ringkasan: 'x'.repeat(301) }]) {
    assert.equal((await request('/api/v1/berita', { token, body })).status, 422);
  }
  for (const path of ['/berita/invalid', '/berita/0', '/berita?page=0', '/berita?limit=51', '/berita?search[x]=test']) {
    assert.equal((await request('/api/v1' + path, { token })).status, 422, path);
  }
});

test('Berita search and pagination return real stored articles', async t => {
  const { token } = (await login('admin_portal', 'Admin@1234')).data.data;
  const marker = `CI-${randomUUID()}`;
  const ids = [];
  t.after(async () => { for (const id of ids) await request(`/api/v1/berita/${id}`, { token, method: 'DELETE' }); });
  for (let index = 0; index < 3; index++) {
    const created = await request('/api/v1/berita', { token, body: { judul: `${marker} kegiatan ${index}`, isi: 'Berita kegiatan sekolah untuk tes pencarian.' } });
    assert.equal(created.status, 201);
    ids.push(created.data.data.id);
  }
  const first = await request(`/api/v1/berita?search=${marker}&limit=2&page=1`, { token });
  assert.equal(first.status, 200);
  assert.equal(first.data.data.total, 3);
  assert.equal(first.data.data.total_pages, 2);
  assert.deepEqual(first.data.data.berita.map(row => row.id), ids.slice().reverse().slice(0, 2));
  const second = await request(`/api/v1/berita?search=${marker}&limit=2&page=2`, { token });
  assert.equal(second.data.data.berita.length, 1);
  assert.equal(second.data.data.berita[0].id, ids[0]);
  const empty = await request(`/api/v1/berita?search=missing-${marker}`, { token });
  assert.equal(empty.data.data.total, 0);
  assert.deepEqual(empty.data.data.berita, []);
});
