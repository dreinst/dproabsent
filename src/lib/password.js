import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

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
