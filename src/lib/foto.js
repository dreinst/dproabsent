import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Foto absen disimpan sebagai berkas, bukan di dalam tabel. Kolom Absensi.photo hanya berisi
// path relatif (mis. 2026/11/ab12.webp). Data lama berupa data URL tetap bisa dibaca.
export const FOTO_DIR = process.env.FOTO_DIR || path.join(process.cwd(), "data", "fotos");
export const MAKS_BYTE = 3 * 1024 * 1024; // batas foto asli setelah decode
const POLA_DATA = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const POLA_REL = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/;

export class FotoError extends Error {}

// Terima data URL dari kamera, kecilkan (maks 720 px) dan ubah ke WebP kualitas 60.
// Metadata (EXIF, lokasi bawaan kamera) dibuang. Isi berkas diperiksa oleh sharp,
// jadi bukan hanya mengandalkan awalan "data:image/".
export async function simpanFoto(dataUrl) {
  const m = POLA_DATA.exec(String(dataUrl || ""));
  if (!m) throw new FotoError("Format foto tidak dikenali. Ambil foto langsung dari kamera.");
  const asli = Buffer.from(m[2], "base64");
  if (asli.length === 0 || asli.length > MAKS_BYTE) throw new FotoError("Ukuran foto terlalu besar.");

  let kecil;
  try {
    kecil = await sharp(asli, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer();
  } catch {
    throw new FotoError("Foto tidak bisa dibaca. Ambil ulang dari kamera.");
  }

  const now = new Date();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.webp`;
  const tujuan = path.join(FOTO_DIR, rel);
  await mkdir(path.dirname(tujuan), { recursive: true });
  await writeFile(tujuan, kecil);
  return { rel, byte: kecil.length };
}

export async function hapusFoto(rel) {
  if (!POLA_REL.test(rel || "")) return;
  await unlink(path.join(FOTO_DIR, rel)).catch(() => {});
}

// Kembalikan { body, type } untuk path relatif atau data URL lama, atau null kalau tidak ada.
export async function bacaFoto(nilai) {
  if (!nilai) return null;
  const m = POLA_DATA.exec(nilai);
  if (m) return { body: Buffer.from(m[2], "base64"), type: `image/${m[1]}` };
  if (!POLA_REL.test(nilai)) return null; // cegah path traversal
  try {
    return { body: await readFile(path.join(FOTO_DIR, nilai)), type: "image/webp" };
  } catch {
    return null;
  }
}
