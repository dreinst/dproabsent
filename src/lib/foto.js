import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Foto absen disimpan sebagai berkas, bukan di dalam tabel. Kolom Absensi.photo hanya berisi
// path relatif (mis. 2026/11/ab12.webp atau .jpg). Data lama berupa data URL tetap bisa dibaca.
export const FOTO_DIR = process.env.FOTO_DIR || path.join(process.cwd(), "data", "fotos");
export const MAKS_BYTE = 3 * 1024 * 1024; // batas foto asli setelah decode
const POLA_DATA = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const POLA_REL = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(webp|jpg)$/;
// Foto dari kamera aplikasi sudah dikecilkan di HP (maks 720 px, JPEG tanpa metadata), jadi disimpan apa adanya.
// Ini menghemat sekitar 75 ms CPU per absen saat ratusan crew absen bersamaan. Foto lain (lebih besar,
// membawa EXIF atau XMP, atau bukan JPEG) tetap dikecilkan dan diubah ke WebP lewat sharp.
const MAKS_SISI_LANGSUNG = 1280;

async function bolehLangsung(jenis, asli) {
  if (jenis !== "jpeg") return false;
  try {
    const info = await sharp(asli).metadata(); // hanya membaca kepala berkas
    return info.format === "jpeg" && !info.exif && !info.xmp
      && (info.width || 0) <= MAKS_SISI_LANGSUNG && (info.height || 0) <= MAKS_SISI_LANGSUNG;
  } catch {
    return false;
  }
}

export class FotoError extends Error {}

// Gambar abu-abu kecil sebagai pengganti foto untuk absen yang dicatat admin atau sistem (pulang otomatis).
export const TANPA_FOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWN49OIDVsQwtCQAK0Sugatr8jQAAAAASUVORK5CYII=";

// Terima data URL dari kamera. JPEG bersih dari aplikasi disimpan langsung; selain itu dikecilkan (maks 720 px)
// dan diubah ke WebP kualitas 60 dengan metadata (EXIF, lokasi bawaan kamera) dibuang. Isi berkas selalu
// diperiksa oleh sharp, jadi bukan hanya mengandalkan awalan "data:image/".
export async function simpanFoto(dataUrl) {
  const m = POLA_DATA.exec(String(dataUrl || ""));
  if (!m) throw new FotoError("Format foto tidak dikenali. Ambil foto langsung dari kamera.");
  const asli = Buffer.from(m[2], "base64");
  if (asli.length === 0 || asli.length > MAKS_BYTE) throw new FotoError("Ukuran foto terlalu besar.");

  let kecil = asli;
  let ext = "jpg";
  if (!(await bolehLangsung(m[1], asli))) {
    ext = "webp";
    try {
      kecil = await sharp(asli, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer();
    } catch {
      throw new FotoError("Foto tidak bisa dibaca. Ambil ulang dari kamera.");
    }
  }

  const now = new Date();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
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
    const type = nilai.endsWith(".jpg") ? "image/jpeg" : "image/webp";
    return { body: await readFile(path.join(FOTO_DIR, nilai)), type };
  } catch {
    return null;
  }
}
