"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin, normalizePhone } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { dariInput } from "@/lib/waktu";
import { namaKapital } from "@/lib/nama";
import { JEDA_MENIT, JEDA_MIN, JEDA_MAKS } from "@/lib/aturan";
import { hapusCache, KUNCI_SESI_AKTIF } from "@/lib/cache";

async function wajibAdmin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/login");
  return user;
}

const kembali = (path, kunci, pesan) => redirect(`${path}?${kunci}=${encodeURIComponent(pesan)}`);
const teks = (f, k) => String(f.get(k) || "").trim();
const bulat = (f, k) => Number.parseInt(f.get(k), 10);

export async function simpanAcara(f) {
  await wajibAdmin();
  const id = bulat(f, "id") || null;
  const path = id ? `/admin/acara/${id}` : "/admin/acara";

  const name = teks(f, "name");
  // Menerima salinan dari Google Maps: "-7.96662, 112.63263".
  const m = teks(f, "koordinat").match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  const lat = m ? Number(m[1]) : NaN;
  const lng = m ? Number(m[2]) : NaN;
  const radiusM = bulat(f, "radiusM");
  const startAt = dariInput(f.get("startAt"));
  const endAt = f.get("endAt") ? dariInput(f.get("endAt")) : null;

  if (!name) kembali(path, "err", "Nama acara wajib diisi.");
  if (!m || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    kembali(path, "err", "Koordinat belum benar. Contoh: -7.96662, 112.63263");
  }
  if (!(radiusM >= 10 && radiusM <= 100000)) kembali(path, "err", "Radius harus antara 10 dan 100000 meter.");
  if (!startAt) kembali(path, "err", "Waktu mulai acara wajib diisi.");
  if (endAt && endAt <= startAt) kembali(path, "err", "Waktu selesai harus setelah waktu mulai.");

  const data = {
    name, lat, lng, radiusM, startAt, endAt,
    client: teks(f, "client") || null,
    active: f.get("active") === "on",
  };
  const acara = id
    ? await prisma.event.update({ where: { id }, data })
    : await prisma.event.create({ data });
  // Daftar sesi aktif di halaman crew ikut berubah.
  await hapusCache(KUNCI_SESI_AKTIF);
  kembali(`/admin/acara/${acara.id}`, "ok", id ? "Data acara berhasil disimpan." : "Acara berhasil dibuat. Silakan tambahkan sesi tugasnya.");
}

export async function simpanSesi(f) {
  await wajibAdmin();
  const eventId = bulat(f, "eventId");
  const id = bulat(f, "id") || null;
  const path = `/admin/acara/${eventId}`;

  const jobdesc = teks(f, "jobdesc");
  const startAt = dariInput(f.get("startAt"));
  const endAt = dariInput(f.get("endAt"));
  const graceMinutes = bulat(f, "graceMinutes") || 0;

  if (!jobdesc) kembali(path, "err", "Nama tugas sesi wajib diisi.");
  if (!startAt || !endAt) kembali(path, "err", "Waktu mulai dan selesai sesi wajib diisi.");
  if (endAt <= startAt) kembali(path, "err", "Waktu selesai sesi harus setelah waktu mulai.");
  if (graceMinutes < 0) kembali(path, "err", "Toleransi keterlambatan tidak boleh negatif.");

  // Jarak titik cek per sesi. Kosong berarti bawaan.
  const mentah = teks(f, "checkpointMinutes");
  const checkpointMinutes = mentah === "" ? JEDA_MENIT : Number(mentah);
  if (!Number.isInteger(checkpointMinutes) || checkpointMinutes < JEDA_MIN || checkpointMinutes > JEDA_MAKS) {
    kembali(path, "err", `Jarak absen progres harus berupa bilangan bulat antara ${JEDA_MIN} dan ${JEDA_MAKS} menit.`);
  }

  const data = { jobdesc, startAt, endAt, checkpointMinutes, graceMinutes };
  if (id) await prisma.session.update({ where: { id, eventId }, data });
  else await prisma.session.create({ data: { ...data, eventId } });
  await hapusCache(KUNCI_SESI_AKTIF);
  kembali(path, "ok", id ? "Sesi berhasil disimpan." : "Sesi berhasil ditambahkan.");
}

export async function hapusSesi(f) {
  await wajibAdmin();
  const eventId = bulat(f, "eventId");
  const id = bulat(f, "id");
  const path = `/admin/acara/${eventId}`;
  // Sesi yang sudah punya absen tidak boleh hilang, karena absennya ikut terhapus.
  const dipakai = await prisma.absensi.count({ where: { sessionId: id } });
  if (dipakai > 0) kembali(path, "err", `Sesi ini sudah memiliki ${dipakai} absen sehingga tidak dapat dihapus.`);
  await prisma.session.delete({ where: { id, eventId } });
  await hapusCache(KUNCI_SESI_AKTIF);
  kembali(path, "ok", "Sesi berhasil dihapus.");
}

// Akun owner hanya boleh disentuh owner, peran owner hanya boleh diberikan owner,
// dan admin tidak boleh mengunci dirinya sendiri.
function cekHak(admin, lama, role, active) {
  if ((lama?.role === "OWNER" || role === "OWNER") && admin.role !== "OWNER") {
    return "Hanya owner yang dapat mengatur akun owner.";
  }
  if (lama?.id === admin.id && (role !== admin.role || !active)) {
    return "Peran dan status akun Anda sendiri tidak dapat diubah dari halaman ini.";
  }
  return null;
}

// Alamat kembali dari sakelar di tabel, supaya saringan dan pencarian tidak hilang.
const balikKe = (f, dasar) => {
  const b = String(f.get("balik") || "");
  return b.startsWith(dasar) ? b.split("&ok=")[0].split("&err=")[0] : dasar;
};
const sambung = (path, kunci, pesan) => redirect(`${path}${path.includes("?") ? "&" : "?"}${kunci}=${encodeURIComponent(pesan)}`);

export async function aktifAcara(f) {
  await wajibAdmin();
  const path = balikKe(f, "/admin/acara");
  const acara = await prisma.event.findUnique({ where: { id: bulat(f, "id") || 0 } });
  if (!acara) sambung(path, "err", "Acara tidak ditemukan.");
  await prisma.event.update({ where: { id: acara.id }, data: { active: !acara.active } });
  await hapusCache(KUNCI_SESI_AKTIF);
  sambung(path, "ok", `Acara ${acara.name} ${acara.active ? "dinonaktifkan" : "diaktifkan"}.`);
}

export async function aktifCrew(f) {
  const admin = await wajibAdmin();
  const path = balikKe(f, "/admin/crew");
  const lama = await prisma.user.findUnique({ where: { id: bulat(f, "id") || 0 } });
  if (!lama) sambung(path, "err", "Akun tidak ditemukan.");
  const tolak = cekHak(admin, lama, lama.role, !lama.active);
  if (tolak) sambung(path, "err", tolak);
  await prisma.user.update({ where: { id: lama.id }, data: { active: !lama.active } });
  sambung(path, "ok", `Akun ${lama.name} ${lama.active ? "dinonaktifkan" : "diaktifkan"}.`);
}

export async function simpanCrew(f) {
  const admin = await wajibAdmin();
  const id = bulat(f, "id") || null;
  const path = "/admin/crew";

  const name = namaKapital(teks(f, "name"));
  const phone = normalizePhone(f.get("phone"));
  const role = teks(f, "role") || "CREW";
  const active = f.get("active") === "on";
  const password = String(f.get("password") || "");

  if (!name) kembali(path, "err", "Nama wajib diisi.");
  if (!/^62\d{8,13}$/.test(phone)) kembali(path, "err", "Nomor HP belum benar. Contoh: 081234567890");
  if (!["OWNER", "SUPERADMIN", "CREW"].includes(role)) kembali(path, "err", "Peran tidak dikenal.");
  if (!id && password.length < 6) kembali(path, "err", "Password akun baru minimal 6 karakter.");
  if (id && password && password.length < 6) kembali(path, "err", "Password baru minimal 6 karakter.");

  const lama = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (id && !lama) kembali(path, "err", "Akun tidak ditemukan.");
  const tolak = cekHak(admin, lama, role, active);
  if (tolak) kembali(path, "err", tolak);
  const kembar = await prisma.user.findUnique({ where: { phone } });
  if (kembar && kembar.id !== id) kembali(path, "err", `Nomor ${phone} sudah digunakan oleh ${kembar.name}.`);

  const data = { name, phone, role, active, bankAccount: teks(f, "bankAccount") || null };
  if (password) data.passwordHash = hashPassword(password);
  if (id) await prisma.user.update({ where: { id }, data });
  else await prisma.user.create({ data });
  kembali(path, "ok", id ? `Akun ${name} berhasil disimpan.` : `Akun ${name} berhasil dibuat.`);
}

// Gambar abu-abu kecil sebagai pengganti foto untuk absen yang dicatat admin.
const TANPA_FOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWN49OIDVsQwtCQAK0Sugatr8jQAAAAASUVORK5CYII=";

// Crew lupa absen pulang: admin mencatatkan pulang di jam selesai shift, tanpa foto, langsung sah.
export async function catatPulang(f) {
  const admin = await wajibAdmin();
  const path = "/admin?f=pulang";
  const masuk = await prisma.absensi.findUnique({
    where: { id: bulat(f, "id") || 0 },
    omit: { photo: true },
    include: { user: true, session: { include: { event: true } } },
  });
  if (!masuk || masuk.kind !== "MASUK") sambung(path, "err", "Absen masuk tidak ditemukan.");
  if (masuk.session.endAt > new Date()) sambung(path, "err", "Shift belum selesai. Crew masih dapat absen pulang sendiri.");
  const sudah = await prisma.absensi.findFirst({
    where: { sessionId: masuk.sessionId, userId: masuk.userId, kind: "PULANG" },
    select: { id: true },
  });
  if (sudah) sambung(path, "err", `${masuk.user.name} sudah memiliki absen pulang di sesi ini.`);

  // Hash dibuat unik per crew dan sesi supaya tidak bentrok dengan pemeriksaan foto identik.
  const photoHash = createHash("sha256").update(`pulang-admin:${masuk.sessionId}:${masuk.userId}`).digest("hex");
  await prisma.absensi.create({
    data: {
      sessionId: masuk.sessionId,
      userId: masuk.userId,
      kind: "PULANG",
      status: "HADIR",
      checkedAt: masuk.session.endAt,
      lat: masuk.session.event.lat,
      lng: masuk.session.event.lng,
      distanceM: 0,
      insideRadius: true,
      photo: TANPA_FOTO,
      photoHash,
      note: `Pulang dicatat oleh ${admin.name} karena crew belum absen pulang, tanpa foto dan lokasi`,
      verifiedById: admin.id,
      verifiedAt: new Date(),
    },
  });
  sambung(path, "ok", `Absen pulang ${masuk.user.name} dicatat pada jam selesai shift.`);
}
