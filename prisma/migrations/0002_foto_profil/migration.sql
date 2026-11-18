-- Foto profil crew. Kolom boleh kosong; tanpa foto, aplikasi menampilkan inisial nama.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
