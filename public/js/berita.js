'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const dashboards = { admin: 'admin', guru: 'guru', siswa: 'siswa', orang_tua: 'ortu' };
  const roles = { admin: 'Administrator', guru: 'Guru', siswa: 'Siswa', orang_tua: 'Orang Tua' };
  let user;
  let page = 1;
  let totalPages = 0;
  let search = '';
  let editingId = null;
  let deletingId = null;
  let listRequest = 0;
  const date = value => new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  const canManage = article => user.role === 'admin' || (user.role === 'guru' && Number(user.id) === Number(article.penulis_id));

  async function api(path, options = {}) {
    const response = await fetch('/api/v1' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) { logout(); throw new Error('Sesi berakhir. Silakan login kembali.'); }
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors ? Object.values(result.errors).join(' ') : result.message || 'Permintaan gagal.');
    return result.data;
  }

  function message(text, error = false) {
    $('statusMessage').textContent = text;
    $('statusMessage').classList.toggle('error', error);
    $('statusMessage').hidden = false;
  }
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.assign('/');
  }
  function sidebar(open) {
    $('sidebar').classList.toggle('open', open);
    $('sidebarOverlay').classList.toggle('open', open);
    $('topbarToggle').setAttribute('aria-expanded', String(open));
  }

  async function detail(id) {
    const article = await api(`/berita/${id}`);
    $('detailTitle').textContent = article.judul;
    $('detailMeta').textContent = `${article.nama_penulis} · ${date(article.created_at)}`;
    $('detailSummary').textContent = article.ringkasan;
    $('detailSummary').hidden = !article.ringkasan;
    // News is plain text: never render article content as HTML.
    $('detailBody').textContent = article.isi;
    $('detailDialog').showModal();
  }

  async function edit(id = null) {
    const article = id ? await api(`/berita/${id}`) : { judul: '', ringkasan: '', isi: '' };
    editingId = id;
    $('editorForm').reset();
    $('judulInput').value = article.judul;
    $('ringkasanInput').value = article.ringkasan;
    $('isiInput').value = article.isi;
    $('editorTitle').textContent = id ? 'Edit Berita' : 'Tulis Berita';
    $('saveButton').textContent = id ? 'Simpan Perubahan' : 'Terbitkan Berita';
    $('editorError').hidden = true;
    $('editorDialog').showModal();
    $('judulInput').focus();
  }

  function confirmDelete(article) {
    deletingId = article.id;
    $('deleteDescription').textContent = `Anda akan menghapus “${article.judul}”.`;
    $('deleteError').hidden = true;
    $('deleteDialog').showModal();
  }

  async function loadList() {
    const request = ++listRequest;
    $('newsList').setAttribute('aria-busy', 'true');
    $('previousPage').disabled = true;
    $('nextPage').disabled = true;
    try {
      const data = await api('/berita?' + new URLSearchParams({ page, limit: 9, search }));
      if (request !== listRequest) return;
      if (page > 1 && !data.berita.length) { page = Math.max(1, data.total_pages); return loadList(); }
      totalPages = data.total_pages;
      $('newsList').replaceChildren();
      for (const article of data.berita) {
        const card = $('newsCardTemplate').content.cloneNode(true);
        card.querySelector('.news-card-title').textContent = article.judul;
        card.querySelector('.news-card-summary').textContent = article.ringkasan || 'Baca selengkapnya untuk mengetahui cerita ini.';
        card.querySelector('.news-card-meta').textContent = `${date(article.created_at)} · ${article.nama_penulis}`;
        card.querySelector('.news-read').addEventListener('click', () => detail(article.id).catch(error => message(error.message, true)));
        if (canManage(article)) {
          card.querySelector('.news-actions').hidden = false;
          card.querySelector('.news-edit').addEventListener('click', () => edit(article.id).catch(error => message(error.message, true)));
          card.querySelector('.news-delete').addEventListener('click', () => confirmDelete(article));
        }
        $('newsList').append(card);
      }
      $('resultCount').textContent = `${data.total} berita${search ? ` untuk “${search}”` : ''}`;
      $('emptyState').hidden = data.berita.length > 0;
      $('emptyTitle').textContent = search ? 'Berita tidak ditemukan' : 'Belum ada berita';
      $('emptyDescription').textContent = search ? 'Coba kata kunci lain atau kosongkan pencarian.' : 'Berita sekolah yang diterbitkan akan tampil di sini.';
      $('pagination').hidden = totalPages <= 1;
      $('pageInfo').textContent = `Halaman ${page} dari ${totalPages}`;
      $('previousPage').disabled = page <= 1;
      $('nextPage').disabled = page >= totalPages;
    } catch (error) {
      if (request === listRequest) { $('resultCount').textContent = 'Berita belum dapat dimuat.'; message(error.message, true); }
    } finally {
      if (request === listRequest) $('newsList').setAttribute('aria-busy', 'false');
    }
  }

  $('editorForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('saveButton').disabled = true;
    $('editorError').hidden = true;
    try {
      const body = JSON.stringify({ judul: $('judulInput').value.trim(), ringkasan: $('ringkasanInput').value.trim(), isi: $('isiInput').value.trim() });
      await api(editingId ? `/berita/${editingId}` : '/berita', { method: editingId ? 'PUT' : 'POST', body });
      $('editorDialog').close();
      message(editingId ? 'Berita berhasil diperbarui.' : 'Berita berhasil diterbitkan.');
      page = 1;
      search = '';
      $('searchInput').value = '';
      await loadList();
    } catch (error) { $('editorError').textContent = error.message; $('editorError').hidden = false; }
    finally { $('saveButton').disabled = false; }
  });
  $('confirmDeleteButton').addEventListener('click', async () => {
    $('confirmDeleteButton').disabled = true;
    try {
      await api(`/berita/${deletingId}`, { method: 'DELETE' });
      $('deleteDialog').close();
      message('Berita berhasil dihapus.');
      await loadList();
    } catch (error) { $('deleteError').textContent = error.message; $('deleteError').hidden = false; }
    finally { $('confirmDeleteButton').disabled = false; }
  });
  $('searchForm').addEventListener('submit', event => {
    event.preventDefault(); page = 1; search = $('searchInput').value.trim(); $('statusMessage').hidden = true; loadList();
  });
  $('previousPage').addEventListener('click', () => { if (page > 1) { page--; loadList(); } });
  $('nextPage').addEventListener('click', () => { if (page < totalPages) { page++; loadList(); } });
  $('createButton').addEventListener('click', () => edit().catch(error => message(error.message, true)));
  $('logoutButton').addEventListener('click', logout);
  $('topbarToggle').addEventListener('click', () => sidebar(!$('sidebar').classList.contains('open')));
  $('sidebarOverlay').addEventListener('click', () => sidebar(false));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));

  async function initialize() {
    if (!localStorage.getItem('token')) { window.location.replace('/'); return; }
    user = await api('/auth/me');
    $('sidebarName').textContent = user.nama_lengkap;
    $('sidebarAvatar').textContent = user.nama_lengkap.charAt(0).toUpperCase();
    $('sidebarRole').textContent = roles[user.role];
    $('dashboardLink').href = `/pages/dashboard-${dashboards[user.role]}.html`;
    $('topbarDate').textContent = date(new Date());
    $('createButton').hidden = !['admin', 'guru'].includes(user.role);
    await loadList();
  }
  initialize().catch(error => message(error.message, true));
})();
