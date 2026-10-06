import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "dproabsent_session";
const SECRET = process.env.AUTH_SECRET || "dev-secret-ganti-di-produksi";

export function normalizePhone(input) {
  let p = String(input || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p;
  return p;
}

function sign(value) {
  const mac = createHmac("sha256", SECRET).update(value).digest("hex");
  return `${value}.${mac}`;
}

function unsign(token) {
  if (!token || !token.includes(".")) return null;
  const idx = token.lastIndexOf(".");
  const value = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = createHmac("sha256", SECRET).update(value).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

export async function setSession(userId) {
  const jar = await cookies();
  jar.set(COOKIE, sign(String(userId)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 jam
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const id = unsign(token);
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user || !user.active) return null;
  return user;
}

export function isAdmin(user) {
  return user && (user.role === "OWNER" || user.role === "SUPERADMIN");
}
