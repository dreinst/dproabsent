import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FOTO_DIR, MAKS_BYTE, FotoError } from "./foto";

// Foto profil disimpan di FOTO_DIR/profil/<uuid>.webp. Kolom User.avatar hanya berisi path relatifnya.
const POLA_DATA = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const POLA_PROFIL = /^profil\/[0-9a-f-]{36}\.webp$/;

// Terima data URL dari kamera, potong persegi 512x512 (fit cover), ubah ke WebP, buang metadata.
export async function simpanProfil(dataUrl) {
  const m = POLA_DATA.exec(String(dataUrl || ""));
  if (!m) throw new FotoError("Format foto tidak dikenali. Ambil foto langsung dari kamera.");
  const asli = Buffer.from(m[2], "base64");
  if (asli.length === 0 || asli.length > MAKS_BYTE) throw new FotoError("Ukuran foto terlalu besar.");

  let hasil;
  try {
    hasil = await sharp(asli, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: 512, height: 512, fit: "cover", position: "centre" })
      .webp({ quality: 75 })
      .toBuffer();
  } catch {
    throw new FotoError("Foto tidak bisa dibaca. Ambil ulang dari kamera.");
  }

  const rel = `profil/${randomUUID()}.webp`;
  const tujuan = path.join(FOTO_DIR, rel);
  await mkdir(path.dirname(tujuan), { recursive: true });
  await writeFile(tujuan, hasil);
  return { rel, byte: hasil.length };
}

export async function hapusProfil(rel) {
  if (!POLA_PROFIL.test(rel || "")) return;
  await unlink(path.join(FOTO_DIR, rel)).catch(() => {});
}

// Kembalikan { body, type } atau null kalau path tidak sah atau berkasnya tidak ada.
export async function bacaProfil(rel) {
  if (!POLA_PROFIL.test(rel || "")) return null; // cegah path traversal
  try {
    return { body: await readFile(path.join(FOTO_DIR, rel)), type: "image/webp" };
  } catch {
    return null;
  }
}
