import { scrypt, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Format: scrypt$<saltHex>$<hashHex>. Cocok untuk password baru maupun impor lama.
export function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(plain), salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, saltHex, hashHex] = stored.split("$");
  const hash = scryptSync(String(plain), Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// Versi asinkron untuk login. scrypt jalan di thread pool Node, jadi ratusan login
// serentak tidak membekukan server seperti scryptSync.
const scryptAsync = promisify(scrypt);
const HASH_PALSU = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;

export async function verifyPasswordAsync(plain, stored) {
  // Hash palsu dipakai saat akun tidak ada, supaya waktu jawabnya sama dan nomor yang terdaftar tidak bisa ditebak.
  const nilai = stored && stored.startsWith("scrypt$") ? stored : HASH_PALSU;
  const [, saltHex, hashHex] = nilai.split("$");
  const hash = await scryptAsync(String(plain), Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return nilai !== HASH_PALSU && hash.length === expected.length && timingSafeEqual(hash, expected);
}
