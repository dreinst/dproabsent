// Uji perhitungan upah. Jalankan: node --test src/lib/upah.test.mjs
// Semua angka harapan dihitung manual di komentar. Tarif bawaan: crew Rp 15.000 per jam (Rp 250 per menit),
// kapten Rp 200.000 per hari, jam kerja normal 8 jam per sesi. Jarak progres 60 menit, jadi batas segmen 60 + 5 = 65 menit.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hitungSesiCrew, hitungKapten, hitungUpahAcara, upahDariMenit, keMenit, tanggalWib,
  fmtRupiah, fmtDurasi, samarkanHp, catatanSesi,
} from "./upah.js";
import { periksaTarif, bacaBulatPositif } from "./pengaturan.js";

const TARIF = { crewPerJam: 15000, kaptenPerHari: 200000, jamPerShift: 8 };

// Jam WIB: j("08:00") atau j("08:00:59", "2026-11-17").
const j = (jam, tgl = "2026-11-18") => new Date(`${tgl}T${jam.length === 5 ? `${jam}:00` : jam}+07:00`);
const sesi = (mulai, selesai, { id = 1, jeda = 60, tgl } = {}) => ({
  id, startAt: j(mulai, tgl), endAt: j(selesai, tgl), checkpointMinutes: jeda,
});
let nomor = 1;
// Absen ditolak juga punya verifiedAt, sama seperti hasil tombol Tolak di halaman Verifikasi.
const absen = (kind, jam, { sah = true, tolak = false, otomatis = false, tgl, sessionId = 1, userId = 1 } = {}) => ({
  id: nomor++, sessionId, userId, kind, otomatis,
  status: tolak ? "TIDAK_HADIR" : "HADIR",
  checkedAt: j(jam, tgl),
  verifiedAt: sah || tolak ? j(jam, tgl) : null,
});
const M = (jam, o) => absen("MASUK", jam, o);
const P = (jam, o) => absen("CHECKPOINT", jam, o);
const K = (jam, o) => absen("PULANG", jam, o);

test("progres tepat waktu: 8 jam penuh", () => {
  // Sesi 08:00 sampai 16:00. Masuk 08:00, progres 09:00 sampai 15:00 (7 kali), pulang 16:00. Semua sah.
  // 8 segmen x 60 menit = 480 menit. Upah 480 x 15.000 / 60 = 120.000. Lembur 480 - 480 = 0.
  const s = sesi("08:00", "16:00");
  const r = hitungSesiCrew(s, [
    M("08:00"), P("09:00"), P("10:00"), P("11:00"), P("12:00"), P("13:00"), P("14:00"), P("15:00"), K("16:00"),
  ], TARIF);
  assert.equal(r.menitDibayar, 480);
  assert.equal(r.upah, 120000);
  assert.equal(r.menitLembur, 0);
  assert.equal(r.menitTerpotong, 0);
  assert.equal(r.menunggu, 0);
  assert.equal(r.segmen.length, 8);
});

test("urutan absen di input tidak berpengaruh", () => {
  // Sama dengan sesi 08:00 sampai 10:00 lengkap, tetapi diberikan terbalik: 60 + 60 = 120 menit, 30.000.
  const s = sesi("08:00", "10:00");
  const r = hitungSesiCrew(s, [K("10:00"), P("09:00"), M("08:00")], TARIF);
  assert.equal(r.menitDibayar, 120);
  assert.equal(r.upah, 30000);
});

test("progres terlambat: segmen dibatasi jarak + 5 menit", () => {
  // Sesi 08:00 sampai 11:00. Masuk 08:00, progres 09:12 (terlambat 12 menit), progres 10:12, pulang 11:00.
  // Segmen 08:00-09:12 = 72 menit, dibatasi 65 (terpotong 7).
  // Segmen 09:12-10:12 = 60. Segmen 10:12-11:00 = 48.
  // Dibayar 65 + 60 + 48 = 173 menit. Upah 173 x 250 = 43.250.
  const s = sesi("08:00", "11:00");
  const terlambat = { ...P("09:12"), status: "TERLAMBAT" };
  const r = hitungSesiCrew(s, [M("08:00"), terlambat, P("10:12"), K("11:00")], TARIF);
  assert.deepEqual(r.segmen.map((x) => x.dibayar), [65, 60, 48]);
  assert.equal(r.menitDibayar, 173);
  assert.equal(r.menitTerpotong, 7);
  assert.equal(r.upah, 43250);
});

test("progres terlewat: celah panjang hanya dibayar sampai batas", () => {
  // Sesi 08:00 sampai 13:00. Masuk 08:00, progres 09:00, (10:00 dan 11:00 terlewat), progres 12:00, pulang 13:00.
  // Segmen: 60, lalu 09:00-12:00 = 180 dibatasi 65 (terpotong 115), lalu 60.
  // Dibayar 60 + 65 + 60 = 185 menit. Upah 185 x 250 = 46.250.
  const s = sesi("08:00", "13:00");
  const r = hitungSesiCrew(s, [M("08:00"), P("09:00"), P("12:00"), K("13:00")], TARIF);
  assert.equal(r.menitDibayar, 185);
  assert.equal(r.menitTerpotong, 115);
  assert.equal(r.upah, 46250);

  // Tanpa progres sama sekali: masuk 08:00, pulang 16:00 di sesi 08:00 sampai 16:00.
  // Satu segmen 480 menit dibatasi 65. Upah 65 x 250 = 16.250.
  const r2 = hitungSesiCrew(sesi("08:00", "16:00"), [M("08:00"), K("16:00")], TARIF);
  assert.equal(r2.menitDibayar, 65);
  assert.equal(r2.upah, 16250);
});

test("jarak progres per sesi ikut menentukan batas segmen", () => {
  // Jarak progres 30 menit, batas segmen 30 + 5 = 35. Masuk 08:00, progres 08:50, pulang 09:00 (sesi 08:00-09:00).
  // Segmen 50 dibatasi 35, lalu 10. Dibayar 45 menit, upah 45 x 250 = 11.250.
  // Sesi impor lama dengan checkpointMinutes 0 memakai jarak bawaan 60, batas 65.
  const r = hitungSesiCrew(sesi("08:00", "09:00", { jeda: 30 }), [M("08:00"), P("08:50"), K("09:00")], TARIF);
  assert.equal(r.batasSegmen, 35);
  assert.equal(r.menitDibayar, 45);
  assert.equal(r.upah, 11250);
  assert.equal(hitungSesiCrew(sesi("08:00", "09:00", { jeda: 0 }), [M("08:00"), K("09:00")], TARIF).batasSegmen, 65);
});

test("absen yang belum sah belum dibayar dan dihitung menunggu", () => {
  // Sesi 08:00 sampai 11:00. Masuk 08:00 sah, progres 09:00 belum sah, progres 10:00 sah, pulang 11:00 belum sah.
  // Segmen 08:00-09:00 ditutup absen belum sah: 0.
  // Segmen 09:00-10:00 ditutup absen sah: 60.
  // Segmen 10:00-11:00 ditutup absen belum sah: 0.
  // Dibayar 60 menit, upah 15.000. Menunggu pengesahan 2.
  const s = sesi("08:00", "11:00");
  const r = hitungSesiCrew(s, [M("08:00"), P("09:00", { sah: false }), P("10:00"), K("11:00", { sah: false })], TARIF);
  assert.deepEqual(r.segmen.map((x) => x.dibayar), [0, 60, 0]);
  assert.equal(r.menitDibayar, 60);
  assert.equal(r.upah, 15000);
  assert.equal(r.menunggu, 2);

  // Setelah semua disahkan: 3 x 60 = 180 menit, upah 45.000, menunggu 0.
  const r2 = hitungSesiCrew(s, [M("08:00"), P("09:00"), P("10:00"), K("11:00")], TARIF);
  assert.equal(r2.upah, 45000);
  assert.equal(r2.menunggu, 0);
});

test("absen masuk belum sah tidak menahan segmen yang penutupnya sah", () => {
  // Aturan hanya mensyaratkan absen penutup segmen sudah sah. Masuk 08:00 belum sah, progres 09:00 sah,
  // pulang 10:00 sah (sesi 08:00-10:00): dibayar 60 + 60 = 120 menit, upah 30.000.
  // Absen masuk tetap dihitung menunggu (1). Kalau nanti ditolak, upah sesi menjadi 0 (uji berikutnya).
  const s = sesi("08:00", "10:00");
  const r = hitungSesiCrew(s, [M("08:00", { sah: false }), P("09:00"), K("10:00")], TARIF);
  assert.equal(r.menitDibayar, 120);
  assert.equal(r.upah, 30000);
  assert.equal(r.menunggu, 1);
});

test("absen ditolak dibuang, pasangan absen menyambung", () => {
  // Sesi 08:00 sampai 11:00. Masuk 08:00, progres 09:00 DITOLAK, progres 10:00, pulang 11:00. Lainnya sah.
  // Tanpa absen 09:00, pasangannya 08:00-10:00 = 120 dibatasi 65 (terpotong 55), lalu 10:00-11:00 = 60.
  // Dibayar 125 menit, upah 125 x 250 = 31.250. Absen ditolak tidak dihitung menunggu.
  const s = sesi("08:00", "11:00");
  const r = hitungSesiCrew(s, [M("08:00"), P("09:00", { tolak: true }), P("10:00"), K("11:00")], TARIF);
  assert.equal(r.menitDibayar, 125);
  assert.equal(r.menitTerpotong, 55);
  assert.equal(r.upah, 31250);
  assert.equal(r.menunggu, 0);
});

test("absen masuk ditolak atau tidak ada: upah sesi 0", () => {
  // Masuk 08:00 ditolak, progres 09:00 dan pulang 10:00 sah: tidak ada absen masuk yang berlaku, upah 0.
  const s = sesi("08:00", "10:00");
  const r = hitungSesiCrew(s, [M("08:00", { tolak: true }), P("09:00"), K("10:00")], TARIF);
  assert.equal(r.upah, 0);
  assert.equal(r.menitDibayar, 0);
  assert.equal(r.masukDitolak, true);
  assert.equal(r.hadir, false);
  assert.equal(r.menunggu, 0);

  // Tanpa absen masuk sama sekali (hanya mungkin dari data impor): upah 0.
  const r2 = hitungSesiCrew(s, [P("09:00"), K("10:00")], TARIF);
  assert.equal(r2.upah, 0);
  assert.equal(r2.tanpaMasuk, true);

  // Absen masuk terkirim dua kali dan yang pertama ditolak: hitungan dimulai dari masuk kedua (08:05).
  // Segmen 08:05-09:00 = 55, 09:00-10:00 = 60. Dibayar 115 menit, upah 28.750.
  const r3 = hitungSesiCrew(s, [M("08:00", { tolak: true }), M("08:05"), P("09:00"), K("10:00")], TARIF);
  assert.equal(r3.menitDibayar, 115);
  assert.equal(r3.upah, 28750);
  assert.equal(r3.masukDitolak, false);
});

test("datang sebelum jam mulai: waktu sebelum jadwal tidak dibayar", () => {
  // Sesi 08:00 sampai 10:00. Masuk 06:50, progres 07:50, progres 08:50, pulang 10:00. Semua sah.
  // Segmen 06:50-07:50 dipotong ke jadwal: mulai maks(06:50, 08:00) = 08:00, selesai 07:50, panjang maks(0, -10) = 0.
  // Segmen 07:50-08:50: mulai 08:00, selesai 08:50 = 50.
  // Segmen 08:50-10:00 = 70, dibatasi 65.
  // Dibayar 0 + 50 + 65 = 115 menit, upah 115 x 250 = 28.750.
  const s = sesi("08:00", "10:00");
  const r = hitungSesiCrew(s, [M("06:50"), P("07:50"), P("08:50"), K("10:00")], TARIF);
  assert.deepEqual(r.segmen.map((x) => x.panjang), [0, 50, 70]);
  assert.equal(r.menitDibayar, 115);
  assert.equal(r.upah, 28750);
});

test("pulang menyusul setelah jam selesai dipotong ke jam selesai", () => {
  // Sesi 08:00 sampai 10:00. Masuk 08:00, progres 09:00, pulang 11:30 sah.
  // Segmen 09:00-11:30 dipotong: selesai min(11:30, 10:00) = 10:00, panjang 60.
  // Dibayar 60 + 60 = 120 menit, upah 30.000.
  const s = sesi("08:00", "10:00");
  const r = hitungSesiCrew(s, [M("08:00"), P("09:00"), K("11:30")], TARIF);
  assert.equal(r.menitDibayar, 120);
  assert.equal(r.upah, 30000);
  assert.equal(r.menitTerpotong, 0);
});

test("pulang otomatis baru dibayar setelah disahkan", () => {
  // Sesi 17:00 sampai 20:00. Masuk 17:00, progres 18:00 dan 19:00 sah, pulang otomatis 20:00 belum sah.
  // Segmen 19:00-20:00 menunggu pengesahan. Dibayar 60 + 60 = 120 menit, upah 30.000, menunggu 1.
  const s = sesi("17:00", "20:00");
  const belum = hitungSesiCrew(s, [M("17:00"), P("18:00"), P("19:00"), K("20:00", { sah: false, otomatis: true })], TARIF);
  assert.equal(belum.menitDibayar, 120);
  assert.equal(belum.upah, 30000);
  assert.equal(belum.menunggu, 1);
  assert.equal(belum.pulangOtomatis, true);
  assert.equal(belum.tanpaPulang, false);
  assert.ok(catatanSesi(belum).includes("Pulang dicatat sistem dan belum disahkan."));

  // Setelah disahkan: 3 x 60 = 180 menit, upah 45.000.
  const sudah = hitungSesiCrew(s, [M("17:00"), P("18:00"), P("19:00"), K("20:00", { otomatis: true })], TARIF);
  assert.equal(sudah.menitDibayar, 180);
  assert.equal(sudah.upah, 45000);
  assert.equal(sudah.menunggu, 0);
});

test("tidak absen pulang: waktu sesudah absen terakhir tidak dibayar", () => {
  // Sesi 08:00 sampai 11:00 sudah selesai. Masuk 08:00, progres 09:00 dan 10:00, tanpa pulang.
  // Segmen hanya 08:00-09:00 dan 09:00-10:00: 120 menit, upah 30.000.
  const s = sesi("08:00", "11:00");
  const r = hitungSesiCrew(s, [M("08:00"), P("09:00"), P("10:00")], TARIF, j("23:00"));
  assert.equal(r.menitDibayar, 120);
  assert.equal(r.upah, 30000);
  assert.equal(r.tanpaPulang, true);

  // Sesi yang masih berlangsung tidak ditandai tidak absen pulang.
  const berjalan = hitungSesiCrew(s, [M("08:00"), P("09:00")], TARIF, j("09:30"));
  assert.equal(berjalan.tanpaPulang, false);
  assert.equal(berjalan.berjalan, true);
});

test("lembur di atas 8 jam tetap dibayar dengan tarif yang sama", () => {
  // Sesi 06:00 sampai 16:00 (10 jam). Masuk 05:55, progres 06:55 sampai 15:55 (10 kali), pulang 16:05.
  // Segmen 05:55-06:55 dipotong ke 06:00-06:55 = 55.
  // 9 segmen antarprogres x 60 = 540.
  // Segmen 15:55-16:05 dipotong ke 15:55-16:00 = 5.
  // Dibayar 55 + 540 + 5 = 600 menit (10 jam). Lembur 600 - 8 x 60 = 120 menit.
  // Upah 600 x 250 = 150.000.
  const s = sesi("06:00", "16:00");
  const progres = ["06:55", "07:55", "08:55", "09:55", "10:55", "11:55", "12:55", "13:55", "14:55", "15:55"].map((x) => P(x));
  const r = hitungSesiCrew(s, [M("05:55"), ...progres, K("16:05")], TARIF);
  assert.equal(r.menitDibayar, 600);
  assert.equal(r.menitLembur, 120);
  assert.equal(r.upah, 150000);

  // Jam kerja normal 9 jam: lembur 600 - 540 = 60 menit, upah tetap 150.000.
  const r2 = hitungSesiCrew(s, [M("05:55"), ...progres, K("16:05")], { ...TARIF, jamPerShift: 9 });
  assert.equal(r2.menitLembur, 60);
  assert.equal(r2.upah, 150000);
});

test("kapten dibayar per hari dari tanggal WIB absen masuk yang sah", () => {
  // Masuk sah 17 Nov 18:55 (sesi 1), 18 Nov 07:55 (sesi 2), 18 Nov 16:50 (sesi 3).
  // Tanggal berbeda: 17 dan 18 Nov. Dua sesi di 18 Nov dihitung satu hari. Jadi 2 hari.
  // Masuk 19 Nov 07:55 belum sah: tidak dihitung, menunggu 1.
  // Masuk 20 Nov 07:55 ditolak: tidak dihitung.
  // Progres dan pulang kapten tidak memengaruhi upah.
  // Upah 2 x 200.000 = 400.000.
  const k = hitungKapten([
    M("18:55", { tgl: "2026-11-17", sessionId: 1 }),
    K("22:10", { tgl: "2026-11-17", sessionId: 1 }),
    M("07:55", { tgl: "2026-11-18", sessionId: 2 }),
    P("09:30", { tgl: "2026-11-18", sessionId: 2, sah: false }),
    M("16:50", { tgl: "2026-11-18", sessionId: 3 }),
    M("07:55", { tgl: "2026-11-19", sessionId: 4, sah: false }),
    M("07:55", { tgl: "2026-11-20", sessionId: 5, tolak: true }),
  ], TARIF);
  assert.deepEqual(k.hari.map((h) => h.tanggal), ["2026-11-17", "2026-11-18"]);
  assert.equal(k.hari[1].masuk.length, 2);
  assert.equal(k.jumlahHari, 2);
  assert.equal(k.upah, 400000);
  assert.equal(k.menunggu, 1);
  assert.equal(k.masukDitolak, 1);
  assert.equal(k.sesiDihadiri, 4); // sesi 1, 2, 3, dan 4 (menunggu); sesi 5 ditolak
});

test("kapten: pergantian tanggal mengikuti WIB, bukan UTC", () => {
  // 18 Nov 23:30 WIB = 18 Nov 16:30 UTC, dan 19 Nov 00:30 WIB = 18 Nov 17:30 UTC.
  // Tanggal UTC keduanya sama, tetapi tanggal WIB berbeda, jadi 2 hari = 400.000.
  const a = M("23:30", { tgl: "2026-11-18" });
  const b = M("00:30", { tgl: "2026-11-19" });
  assert.equal(a.checkedAt.toISOString().slice(0, 10), b.checkedAt.toISOString().slice(0, 10));
  assert.equal(tanggalWib(a.checkedAt), "2026-11-18");
  assert.equal(tanggalWib(b.checkedAt), "2026-11-19");
  assert.equal(hitungKapten([a, b], TARIF).upah, 400000);
});

test("pembulatan ke rupiah terdekat, per sesi", () => {
  // 7 menit dengan tarif 15.500: 7 x 15.500 / 60 = 1.808,33, dibulatkan 1.808.
  assert.equal(upahDariMenit(7, 15500), 1808);
  // 1 menit dengan tarif 15.030: 15.030 / 60 = 250,5, setengah dibulatkan ke atas menjadi 251.
  assert.equal(upahDariMenit(1, 15030), 251);
  // 1 menit dengan tarif 15.020: 250,33 dibulatkan 250.
  assert.equal(upahDariMenit(1, 15020), 250);

  // Dua sesi masing-masing 7 menit dengan tarif 15.500. Pembulatan per sesi: 1.808 + 1.808 = 3.616,
  // bukan 14 x 15.500 / 60 = 3.616,67 yang akan menjadi 3.617.
  const tarif = { ...TARIF, crewPerJam: 15500 };
  const s1 = sesi("08:00", "08:07", { id: 1 });
  const s2 = sesi("09:00", "09:07", { id: 2 });
  const hasil = hitungUpahAcara({
    sesi: [s1, s2], tarif, orang: [{ id: 1, name: "Uji" }],
    absen: [M("08:00", { sessionId: 1 }), K("08:07", { sessionId: 1 }), M("09:00", { sessionId: 2 }), K("09:07", { sessionId: 2 })],
  });
  assert.deepEqual(hasil.orang[0].sesi.map((r) => r.upah), [1808, 1808]);
  assert.equal(hasil.orang[0].upah, 3616);
  assert.equal(hasil.total.upah, 3616);
});

test("detik diabaikan, waktu dihitung per menit seperti yang tampil di layar", () => {
  // Sesi 08:00 sampai 10:00. Masuk 08:00:59 dihitung 08:00, progres 09:00:01 dihitung 09:00, pulang 10:00:30 dihitung 10:00.
  // Dibayar 60 + 60 = 120 menit, upah 30.000.
  const s = sesi("08:00", "10:00");
  const r = hitungSesiCrew(s, [M("08:00:59"), P("09:00:01"), K("10:00:30")], TARIF);
  assert.equal(r.menitDibayar, 120);
  assert.equal(r.upah, 30000);
  assert.equal(keMenit(j("08:00:59")) - keMenit(j("08:00")), 0);
});

test("rekap acara: kapten dibayar per hari walau punya absen progres, total keseluruhan benar", () => {
  // Sesi 1: 18 Nov 08:00-10:00. Sesi 2: 18 Nov 17:00-19:00.
  // Ani (crew): sesi 1 lengkap 120 menit (30.000) dan sesi 2 lengkap 120 menit (30.000). Total 240 menit, 60.000.
  // Budi (kapten): masuk sah di sesi 1 dan 2 (tanggal sama), plus progres. 1 hari = 200.000, bukan per jam.
  // Citra (kapten tanpa absen): 0 hari, Rp 0, tetap tampil.
  // Dodi (crew): masuk ditolak di sesi 1: Rp 0.
  // Total: 60.000 + 200.000 + 0 + 0 = 260.000.
  const s1 = sesi("08:00", "10:00", { id: 1 });
  const s2 = sesi("17:00", "19:00", { id: 2 });
  const o = (userId, sessionId) => ({ userId, sessionId });
  const hasil = hitungUpahAcara({
    sesi: [s2, s1],
    tarif: TARIF,
    kapten: [2, 3],
    orang: [{ id: 1, name: "Ani" }, { id: 2, name: "Budi" }, { id: 3, name: "Citra" }, { id: 4, name: "Dodi" }],
    absen: [
      M("08:00", o(1, 1)), P("09:00", o(1, 1)), K("10:00", o(1, 1)),
      M("17:00", o(1, 2)), P("18:00", o(1, 2)), K("19:00", o(1, 2)),
      M("07:58", o(2, 1)), P("09:00", o(2, 1)), K("10:00", o(2, 1)), M("16:55", o(2, 2)),
      M("08:00", { ...o(4, 1), tolak: true }), P("09:00", o(4, 1)),
      // Absen di sesi acara lain diabaikan.
      M("08:00", o(1, 99)), K("12:00", o(1, 99)),
    ],
    sekarang: j("23:00"),
  });
  const per = Object.fromEntries(hasil.orang.map((r) => [r.user.name, r]));
  assert.deepEqual(hasil.orang.map((r) => r.user.name), ["Budi", "Citra", "Ani", "Dodi"]);
  assert.equal(per.Ani.peran, "CREW");
  assert.equal(per.Ani.menitDibayar, 240);
  assert.equal(per.Ani.upah, 60000);
  assert.equal(per.Ani.sesiDihadiri, 2);
  assert.deepEqual(per.Ani.sesi.map((r) => r.sesi.id), [1, 2]);
  assert.equal(per.Budi.peran, "KAPTEN");
  assert.equal(per.Budi.jumlahHari, 1);
  assert.equal(per.Budi.upah, 200000);
  assert.equal(per.Budi.menitDibayar, 0);
  assert.equal(per.Citra.upah, 0);
  assert.deepEqual(per.Citra.catatan, ["Belum ada absen masuk yang disahkan"]);
  assert.equal(per.Dodi.upah, 0);
  assert.equal(per.Dodi.sesiDihadiri, 0);
  assert.match(per.Dodi.catatan[0], /Absen masuk ditolak di 1 sesi/);
  assert.equal(hasil.total.upah, 260000);
  assert.equal(hasil.total.upahCrew, 60000);
  assert.equal(hasil.total.upahKapten, 200000);
  assert.equal(hasil.total.crew, 2);
  assert.equal(hasil.total.kapten, 2);
  assert.equal(hasil.total.menitDibayar, 240);
});

test("format rupiah, durasi, dan nomor HP disamarkan", () => {
  assert.equal(fmtRupiah(1234500), "Rp 1.234.500");
  assert.equal(fmtRupiah(0), "Rp 0");
  assert.equal(fmtDurasi(450), "7 jam 30 menit");
  assert.equal(fmtDurasi(480), "8 jam");
  assert.equal(fmtDurasi(45), "45 menit");
  assert.equal(fmtDurasi(0), "0 menit");
  assert.equal(samarkanHp("6281234564321"), "0812****4321");
  assert.equal(samarkanHp("081234564321"), "0812****4321");
  assert.equal(samarkanHp(""), "****");
});

test("validasi tarif: hanya bilangan bulat positif", () => {
  const sah = periksaTarif({ crewPerJam: " 15000 ", kaptenPerHari: "200000", jamPerShift: "8" });
  assert.deepEqual(sah, { nilai: { crewPerJam: 15000, kaptenPerHari: 200000, jamPerShift: 8 } });
  for (const salah of ["15.000", "15,5", "0", "-5", "abc", "", "1e4", "15000.0"]) {
    assert.equal(bacaBulatPositif(salah), null, `"${salah}" harus ditolak`);
    assert.ok(periksaTarif({ crewPerJam: salah, kaptenPerHari: "200000", jamPerShift: "8" }).galat);
  }
  assert.match(periksaTarif({ crewPerJam: "15000", kaptenPerHari: "200000", jamPerShift: "25" }).galat, /paling besar 24/);
});
