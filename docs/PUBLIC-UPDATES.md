# Distribusi publik dan pembaruan otomatis

Pengguna tidak perlu didaftarkan sebagai runner GitHub. Mereka mengunduh paket pada https://github.com/Thienry18/PortalAkademikGajahMada-Releases dan menjalankan Install-Portal.ps1 sekali. Installer Windows mengaktifkan pemeriksaan lima menit melalui Task Scheduler. Docker Desktop dan sesi pengguna harus aktif. Installer memakai empat container aplikasi; tidak ada container updater kelima.

Image publik berada di Docker Hub thien18/portal-akademik-frontend, thien18/portal-akademik-backend, dan thien18/portal-akademik-gateway. MySQL memakai image resmi yang dipatok pada digest. Sumber aplikasi utama tetap berada di repo privat. Instalasi Windows x64 menggunakan Linux containers amd64; arsitektur ARM belum dipublikasikan. Core updater juga diuji pada PowerShell 7/Linux dengan penjadwalan dinonaktifkan, tetapi penjadwalan otomatis dalam installer saat ini khusus Windows.

## Alur penerbitan

1. CI membangun image dan menjalankan pengujian aplikasi serta integrasi updater.
2. Integrasi updater benar-benar memasang empat container terpisah, memperbarui release A ke B, mempertahankan secret/berita/database, lalu mencoba image frontend yang sengaja unhealthy dan memeriksa pemulihan ke B.
3. CI mempublikasikan image GHCR dan artifact teruji seperti sebelumnya.
4. CD memperbarui instalasi staging lokal. Backend /health harus melaporkan SHA release yang sama dengan commit.
5. Job publish-public berjalan hanya setelah CI dan CD sukses. Job ini memakai Docker Desktop login thien18 dan Git Credential Manager milik penerbit di runner Windows yang sama. Tidak ada token penerbit yang didistribusikan kepada pengguna.
6. Script menyalin image yang sudah diuji ke Docker Hub dengan tag SHA, lalu meminta manifest registry menggunakan autentikasi pull anonim untuk memastikan image publik tersedia.
7. Bootstrap ZIP hanya berisi compose.yaml dan database/schema.sql. Semua image dipatok dengan digest SHA256. Setelah ketiganya tersedia, satu commit ke repo distribusi mempublikasikan paket versi dan stable.json secara bersamaan.
8. Updater pengguna membaca stable.json, mengunduh seluruh image aplikasi terlebih dahulu, kemudian mengganti layanan aplikasi dan memeriksa health, identitas SHA, halaman frontend, dan tepat empat service.

Repo distribusi publik hanya berisi installer, panduan, bootstrap, serta manifest. Tidak memuat .env, password penerbit, kredensial registry, data akademik, atau folder runner. Isi kode aplikasi tetap dapat diperiksa dari image publik, sebagaimana sifat distribusi image aplikasi.

## Penyimpanan dan pemulihan

Folder default pengguna: %LOCALAPPDATA%/PortalAkademik. Project Compose diberi identitas berdasarkan folder instalasi agar tidak bertabrakan dengan project pengembangan. Port default 8080 dapat diganti melalui parameter -Port.

.env dibuat sekali dengan password database dan JWT acak. Compose dan schema bootstrap disimpan pada path tetap. Pembaruan aplikasi mempertahankan container MySQL dan named volume, serta tidak menaikkan image MySQL secara otomatis. Jika rilis memerlukan database baru, perubahan format Compose, atau clientCompatibility baru, updater menolak sampai prosedur upgrade yang sesuai disediakan.

State baru dicatat setelah pemeriksaan sukses. Bila startup/health gagal, updater menjalankan image release sebelumnya dengan database dan secret yang sama. Rilis gagal ditandai supaya tidak menyebabkan siklus gagal/rollback berulang setiap lima menit. Perintah -Force tersedia untuk retry manual setelah masalah diperbaiki. Rollback hanya berlaku untuk aplikasi, bukan data atau migrasi; migrasi harus tetap aditif dan kompatibel.

Lock file eksklusif dan pengaturan Task Scheduler IgnoreNew mencegah pembaruan tumpang tindih. Sequence rilis mencegah kanal lama diterapkan sebagai pembaruan. Mode produksi menerima metadata/bootstrap HTTPS hanya dari repo distribusi yang ditentukan, dan hanya image namespace Docker Hub yang ditentukan dengan digest. TestMode untuk fixture lokal tidak diaktifkan oleh installer pengguna normal.

## Mempertahankan preferensi runner penerbit

Installer publik mempunyai jadwal updaternya sendiri. Konfigurasi ini tidak menambahkan startup otomatis untuk runner GitHub penerbit; runner yang sudah ada tetap dimulai manual sesuai pilihan pengguna. Publikasi rilis baru menunggu runner penerbit dan staging Docker aktif.
