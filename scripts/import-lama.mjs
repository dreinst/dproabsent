// Impor data sistem lama (dpro.sql) ke database dproabsent untuk preview.
// Pakai: DATABASE_URL=... node scripts/import-lama.mjs /path/ke/dpro.sql
// Idempoten: menghapus Absensi/Session/Event + user CREW lalu mengisi ulang.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();
const SQL_PATH = process.argv[2] || `${process.env.HOME}/Downloads/DPRO/dpro.sql`;
const MALANG = { lat: -7.96662, lng: 112.632629 };

function parseRows(sql, table) {
  const out = [];
  const re = new RegExp("INSERT INTO `" + table + "`[^;]*?VALUES\\s*([\\s\\S]*?);\\n", "g");
  let blk;
  while ((blk = re.exec(sql))) {
    const tuples = blk[1].matchAll(/\(((?:[^)('']|'(?:[^'\\]|\\.)*')*)\)/g);
    for (const t of tuples) {
      const vals = [];
      const vre = /'((?:[^'\\]|\\.)*)'|NULL|(-?[\d.]+)/g;
      let m;
      while ((m = vre.exec(t[1]))) {
        if (m[1] !== undefined) vals.push(m[1].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, "\n"));
        else if (m[2] !== undefined) vals.push(m[2]);
        else vals.push(null);
      }
      out.push(vals);
    }
  }
  return out;
}

function normPhone(x) {
  let p = String(x || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p;
  return p;
}

function haversine(a1, o1, a2, o2) {
  const R = 6371000, r = (d) => (d * Math.PI) / 180;
  const dLat = r(a2 - a1), dLng = r(o2 - o1);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a1)) * Math.cos(r(a2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160'><rect width='120' height='160' fill='#e2e8f0'/><text x='60' y='78' font-family='sans-serif' font-size='11' fill='#64748b' text-anchor='middle'>foto lama</text><text x='60' y='94' font-family='sans-serif' font-size='11' fill='#94a3b8' text-anchor='middle'>di server</text></svg>`
  );

function toDate(d, t) {
  if (!d) return null;
  let s = String(d).trim();
  if (t) s += " " + t;
  else if (!/\d{1,2}:\d{2}/.test(s)) s += " 00:00:00";
  const dt = new Date(s.replace(" ", "T"));
  return isNaN(dt) ? null : dt;
}

async function main() {
  const sql = readFileSync(SQL_PATH, "utf8");
  const peg = parseRows(sql, "pegawai");
  const kronik = parseRows(sql, "kronik");
  const detail = parseRows(sql, "kronik_detail");
  const absent = parseRows(sql, "kronik_absent");
  const jobdesc = Object.fromEntries(parseRows(sql, "master_jobdesc").map((r) => [r[0], r[1]]));
  const klien = Object.fromEntries(parseRows(sql, "klien").map((r) => [r[0], r[1]]));
  const level = Object.fromEntries(parseRows(sql, "master_kronik_level").map((r) => [r[0], r[1]]));
  console.log(`Sumber: ${peg.length} pegawai, ${kronik.length} acara, ${detail.length} sesi, ${absent.length} absen`);

  // Bersihkan data lama (pertahankan owner/superadmin demo).
  await prisma.absensi.deleteMany();
  await prisma.session.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany({ where: { role: "CREW" } });
  await prisma.user.deleteMany({ where: { legacyId: { not: null } } });

  // Users dari pegawai. Donny (6281938938800) jadi OWNER, sisanya CREW.
  const seenPhone = new Set();
  const userData = [];
  for (const r of peg) {
    const [id, nama, hp, jabatan, rek, , pwd] = r;
    const phone = normPhone(hp);
    if (!phone || phone.length < 10 || seenPhone.has(phone)) continue;
    seenPhone.add(phone);
    userData.push({
      name: nama || `Crew ${id}`,
      phone,
      passwordHash: hashPassword(pwd && pwd.length >= 4 ? pwd : "123456"),
      role: phone === "6281938938800" ? "OWNER" : "CREW",
      bankAccount: rek || null,
      legacyId: Number(id),
    });
  }
  await prisma.user.createMany({ data: userData, skipDuplicates: true });
  const users = await prisma.user.findMany({ where: { legacyId: { not: null } } });
  const userByLegacy = new Map(users.map((u) => [u.legacyId, u.id]));
  const owner = (await prisma.user.findFirst({ where: { role: "OWNER" } }))?.id;
  console.log(`User dibuat: ${userData.length}`);

  // Koordinat acara dari median titik absen crew per acara.
  const detailById = new Map(detail.map((d) => [d[0], d]));
  const coordsByKronik = {};
  for (const a of absent) {
    const d = detailById.get(a[1]);
    if (!d) continue;
    const lat = parseFloat(a[5]), lng = parseFloat(a[6]);
    if (!lat || !lng) continue;
    (coordsByKronik[d[1]] ||= []).push([lat, lng]);
  }
  const median = (arr) => arr.slice().sort((x, y) => x - y)[Math.floor(arr.length / 2)];

  // Events.
  const eventByLegacy = new Map();
  for (const k of kronik) {
    const [id, tgl, jam, klienID, nama] = k;
    const start = toDate(tgl, jam);
    if (!start) continue;
    const pts = coordsByKronik[id] || [];
    const lat = pts.length ? median(pts.map((p) => p[0])) : MALANG.lat;
    const lng = pts.length ? median(pts.map((p) => p[1])) : MALANG.lng;
    const ev = await prisma.event.create({
      data: {
        name: nama || `Acara ${id}`,
        client: klien[klienID] || null,
        lat, lng,
        radiusM: pts.length ? 200 : 500,
        startAt: start,
        endAt: new Date(start.getTime() + 12 * 3600000),
        active: true,
      },
    });
    eventByLegacy.set(id, ev.id);
  }
  console.log(`Acara dibuat: ${eventByLegacy.size}`);

  // Sessions dari kronik_detail.
  const sessionByLegacy = new Map();
  for (const d of detail) {
    const [id, kronikID, jobDescID, tglAwal, tglAkhir] = d;
    const eid = eventByLegacy.get(kronikID);
    if (!eid) continue;
    const start = toDate(tglAwal);
    const end = toDate(tglAkhir) || (start ? new Date(start.getTime() + 6 * 3600000) : null);
    if (!start) continue;
    const se = await prisma.session.create({
      data: {
        eventId: eid,
        jobdesc: jobdesc[jobDescID] || "Tugas",
        startAt: start,
        endAt: end,
        checkpointMinutes: 0,
        graceMinutes: 15,
      },
    });
    sessionByLegacy.set(id, se.id);
  }
  console.log(`Sesi dibuat: ${sessionByLegacy.size}`);

  // Absensi.
  const evCoord = new Map();
  for (const [lid, eid] of eventByLegacy) {
    const e = await prisma.event.findUnique({ where: { id: eid }, select: { lat: true, lng: true, radiusM: true } });
    evCoord.set(lid, e);
  }
  const rows = [];
  let skip = 0;
  for (const a of absent) {
    const [id, detailID, pegawaiID, foto, tgl, lat, lng, checkAbsent, tglUpdate] = a;
    const sid = sessionByLegacy.get(detailID);
    const uid = userByLegacy.get(Number(pegawaiID));
    const d = detailById.get(detailID);
    const e = d ? evCoord.get(d[1]) : null;
    const checkedAt = toDate(tgl);
    if (!sid || !uid || !e || !checkedAt) { skip++; continue; }
    const la = parseFloat(lat), ln = parseFloat(lng);
    const dist = la && ln ? haversine(la, ln, e.lat, e.lng) : 0;
    const inside = dist <= e.radiusM;
    const session = await Promise.resolve(sessionByLegacy.get(detailID));
    const notes = [`Data lama${foto ? `, foto: ${foto}` : ""}`];
    if (!inside) notes.push(`di luar radius (${dist} m)`);
    const verified = checkAbsent === "1";
    rows.push({
      sessionId: sid,
      userId: uid,
      kind: "MASUK",
      status: "HADIR",
      checkedAt,
      lat: la || e.lat,
      lng: ln || e.lng,
      distanceM: dist,
      insideRadius: inside,
      photo: PLACEHOLDER,
      photoHash: createHash("sha256").update(`lama-${id}-${foto || ""}`).digest("hex"),
      note: notes.join(", "),
      verifiedById: verified ? owner : null,
      verifiedAt: verified ? (toDate(tglUpdate) || checkedAt) : null,
    });
  }
  // Status TERLAMBAT kalau absen lewat 15 menit dari mulai sesi.
  const sessStart = new Map();
  for (const [lid, sid] of sessionByLegacy) {
    const se = await prisma.session.findUnique({ where: { id: sid }, select: { startAt: true } });
    sessStart.set(sid, se.startAt);
  }
  for (const r of rows) {
    const st = sessStart.get(r.sessionId);
    if (st && r.checkedAt > new Date(st.getTime() + 15 * 60000)) r.status = "TERLAMBAT";
  }
  for (let i = 0; i < rows.length; i += 200) {
    await prisma.absensi.createMany({ data: rows.slice(i, i + 200), skipDuplicates: true });
  }
  console.log(`Absensi dibuat: ${rows.length} (dilewati ${skip})`);

  // Pastikan owner/superadmin demo tetap ada.
  for (const u of [
    { name: "Owner Demo", phone: "628000000001", role: "OWNER", pwd: "owner123" },
    { name: "Superadmin Demo", phone: "628000000002", role: "SUPERADMIN", pwd: "super123" },
  ]) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: { role: u.role },
      create: { name: u.name, phone: u.phone, role: u.role, passwordHash: hashPassword(u.pwd) },
    });
  }
  const totalUser = await prisma.user.count();
  console.log(`Selesai. Total user: ${totalUser}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
