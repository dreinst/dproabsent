// Perhitungan upah crew dan kapten per acara.
// Tujuannya: upah dibayar per jam berdasarkan kerja yang terbukti lewat absen yang sudah disahkan,
// sehingga lembur tanpa kerja tidak ikut dibayar.
//
// Semua fungsi di berkas ini murni. Tidak ada akses database dan tidak ada pembacaan jam sistem,
// jadi bisa diuji langsung dengan `node --test src/lib/upah.test.mjs`.
// Pengambilan data dari database ada di src/lib/data-upah.js.
//
// Aturan crew, dihitung per sesi:
// 1. Absen crew di sesi itu diurutkan menurut waktu, lalu absen yang ditolak (TIDAK_HADIR) dibuang.
//    Hitungan dimulai dari absen masuk pertama yang tidak ditolak. Tanpa absen masuk itu, upah sesi 0.
// 2. Setiap pasangan absen berurutan membentuk satu segmen, dipotong ke jadwal sesi:
//    mulai = maks(absen sebelumnya, jam mulai sesi), selesai = min(absen sesudahnya, jam selesai sesi).
// 3. Segmen dibayar hanya kalau absen penutupnya sudah disahkan, paling lama jarak progres sesi + 5 menit.
//    Pulang otomatis dari sistem diperlakukan sama: baru dibayar setelah disahkan.
// 4. Upah sesi = menit dibayar x tarif per jam / 60, dibulatkan ke rupiah terdekat.
//    Menit di atas jam kerja normal per sesi ditampilkan sebagai lembur, dengan tarif yang sama.
// Waktu dihitung per menit penuh, sama dengan jam yang tampil di layar (detik diabaikan).
//
// Aturan kapten: kalau tercatat sebagai kapten acara, dibayar per hari, bukan per jam.
// Jumlah hari = banyaknya tanggal WIB berbeda yang memiliki absen masuk yang sah dan tidak ditolak.

import { jedaSesi, BATAS_MENIT } from "./aturan.js";

const MENIT_MS = 60000;
const WIB_MS = 7 * 3600000; // WIB selalu UTC+7, tanpa pergeseran musim
const URUTAN_JENIS = { MASUK: 0, CHECKPOINT: 1, PULANG: 2 };

const waktu = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

// Waktu sebagai hitungan menit penuh. Detik dibuang, seperti jam "08.00" yang tampil di layar.
export const keMenit = (d) => Math.floor(waktu(d) / MENIT_MS);

// Tanggal WIB berbentuk "2026-11-18".
export const tanggalWib = (d) => new Date(waktu(d) + WIB_MS).toISOString().slice(0, 10);

export const ditolak = (a) => a.status === "TIDAK_HADIR";
export const sudahSah = (a) => a.verifiedAt != null;

// Urut menurut waktu. Kalau waktunya sama: masuk, progres, lalu pulang, kemudian menurut id.
export function urutkanAbsen(daftar) {
  return [...daftar].sort(
    (a, b) =>
      waktu(a.checkedAt) - waktu(b.checkedAt) ||
      (URUTAN_JENIS[a.kind] ?? 9) - (URUTAN_JENIS[b.kind] ?? 9) ||
      (a.id ?? 0) - (b.id ?? 0)
  );
}

// Upah dari menit dibayar, dibulatkan ke rupiah terdekat (setengah rupiah dibulatkan ke atas).
export const upahDariMenit = (menit, tarifPerJam) => Math.round((menit * tarifPerJam) / 60);

// Upah crew untuk satu sesi.
// sesi: { id, startAt, endAt, checkpointMinutes }
// absen: absen milik satu crew di sesi itu, urutan bebas. Kolom yang dipakai:
//   id, kind, status, checkedAt, verifiedAt, otomatis.
// tarif: { crewPerJam, jamPerShift }
// sekarang (opsional): untuk menandai sesi yang belum selesai.
export function hitungSesiCrew(sesi, absen, tarif, sekarang) {
  const urut = urutkanAbsen(absen);
  const tidakDitolak = urut.filter((a) => !ditolak(a));
  const awal = tidakDitolak.findIndex((a) => a.kind === "MASUK");
  const rantai = awal < 0 ? [] : tidakDitolak.slice(awal);

  const batasSegmen = jedaSesi(sesi) + BATAS_MENIT;
  const mulaiSesi = keMenit(sesi.startAt);
  const akhirSesi = keMenit(sesi.endAt);

  const segmen = [];
  for (let i = 1; i < rantai.length; i++) {
    const dari = rantai[i - 1];
    const ke = rantai[i];
    const mulai = Math.max(keMenit(dari.checkedAt), mulaiSesi);
    const selesai = Math.min(keMenit(ke.checkedAt), akhirSesi);
    const panjang = Math.max(0, selesai - mulai);
    const dibatasi = Math.min(panjang, batasSegmen);
    const sah = sudahSah(ke);
    segmen.push({ dari: dari.id, ke: ke.id, jenisPenutup: ke.kind, panjang, dibatasi, sah, dibayar: sah ? dibatasi : 0 });
  }

  const menitDibayar = segmen.reduce((t, s) => t + s.dibayar, 0);
  // Menit kerja di segmen sah yang tidak dibayar karena melewati batas jarak progres + 5 menit.
  const menitTerpotong = segmen.reduce((t, s) => t + (s.sah ? s.panjang - s.dibatasi : 0), 0);
  const pulang = rantai.find((a) => a.kind === "PULANG") ?? null;
  const berjalan = sekarang ? waktu(sesi.endAt) > waktu(sekarang) : false;
  const adaMasuk = urut.some((a) => a.kind === "MASUK");

  return {
    hadir: rantai.length > 0,
    masuk: rantai[0] ?? null,
    pulang,
    masukDitolak: rantai.length === 0 && adaMasuk,
    tanpaMasuk: rantai.length === 0 && !adaMasuk && urut.length > 0,
    tanpaPulang: rantai.length > 0 && !pulang && !berjalan,
    pulangOtomatis: Boolean(pulang?.otomatis),
    berjalan,
    batasSegmen,
    menitDibayar,
    menitLembur: Math.max(0, menitDibayar - tarif.jamPerShift * 60),
    menitTerpotong,
    menunggu: rantai.filter((a) => !sudahSah(a)).length,
    upah: upahDariMenit(menitDibayar, tarif.crewPerJam),
    segmen,
  };
}

// Upah kapten untuk satu acara.
// absen: semua absen kapten itu di sesi-sesi acara tersebut. tarif: { kaptenPerHari }
export function hitungKapten(absen, tarif) {
  const masuk = urutkanAbsen(absen).filter((a) => a.kind === "MASUK");
  const perTanggal = new Map();
  for (const a of masuk) {
    if (ditolak(a) || !sudahSah(a)) continue;
    const tanggal = tanggalWib(a.checkedAt);
    if (!perTanggal.has(tanggal)) perTanggal.set(tanggal, { tanggal, masuk: [] });
    perTanggal.get(tanggal).masuk.push(a);
  }
  // Absen masuk sudah urut waktu, jadi tanggal di Map juga sudah urut.
  const hari = [...perTanggal.values()].map((h) => ({ ...h, upah: tarif.kaptenPerHari }));
  return {
    hari,
    jumlahHari: hari.length,
    upah: hari.length * tarif.kaptenPerHari,
    menunggu: masuk.filter((a) => !ditolak(a) && !sudahSah(a)).length,
    masukDitolak: masuk.filter(ditolak).length,
    sesiDihadiri: new Set(masuk.filter((a) => !ditolak(a)).map((a) => a.sessionId)).size,
  };
}

// Rekap upah satu acara untuk semua orang yang punya absen di acara itu, ditambah semua kapten acara.
// sesi: sesi-sesi acara. absen: absen di sesi-sesi itu (kolom tambahan sessionId dan userId).
// kapten: daftar userId kapten acara. orang: data akun { id, name, ... } untuk nama dan urutan.
// tarif: { crewPerJam, kaptenPerHari, jamPerShift }.
export function hitungUpahAcara({ sesi, absen, kapten = [], orang = [], tarif, sekarang }) {
  const sesiUrut = [...sesi].sort((a, b) => waktu(a.startAt) - waktu(b.startAt) || a.id - b.id);
  const idSesi = new Set(sesiUrut.map((s) => s.id));
  const idKapten = new Set(kapten);
  const akun = new Map(orang.map((u) => [u.id, u]));

  const absenPerOrang = new Map();
  for (const a of absen) {
    if (!idSesi.has(a.sessionId)) continue;
    if (!absenPerOrang.has(a.userId)) absenPerOrang.set(a.userId, []);
    absenPerOrang.get(a.userId).push(a);
  }

  const hasil = [];
  for (const id of new Set([...absenPerOrang.keys(), ...idKapten])) {
    const milik = absenPerOrang.get(id) ?? [];
    const user = akun.get(id) ?? { id, name: `Akun #${id}` };

    if (idKapten.has(id)) {
      const k = hitungKapten(milik, tarif);
      hasil.push({
        user, peran: "KAPTEN", sesiDihadiri: k.sesiDihadiri, menitDibayar: 0, menitLembur: 0,
        jumlahHari: k.jumlahHari, hari: k.hari, upah: k.upah, menunggu: k.menunggu, sesi: [],
        catatan: catatanKapten(k),
        // Catatan kapten tidak memuat bahasa uang, jadi Panel kapten memakai catatan yang sama.
        catatanProgres: catatanKapten(k),
      });
      continue;
    }

    const perSesi = [];
    for (const s of sesiUrut) {
      const absenSesi = milik.filter((a) => a.sessionId === s.id);
      if (absenSesi.length) perSesi.push({ sesi: s, ...hitungSesiCrew(s, absenSesi, tarif, sekarang) });
    }
    const jumlah = (kunci) => perSesi.reduce((t, r) => t + (typeof r[kunci] === "boolean" ? Number(r[kunci]) : r[kunci]), 0);
    const fakta = {
      masukDitolak: jumlah("masukDitolak"),
      tanpaMasuk: jumlah("tanpaMasuk"),
      tanpaPulang: jumlah("tanpaPulang"),
      pulangOtomatis: jumlah("pulangOtomatis"),
      berjalan: perSesi.filter((r) => r.berjalan && r.hadir).length,
      menitTerpotong: jumlah("menitTerpotong"),
    };
    hasil.push({
      user, peran: "CREW",
      sesiDihadiri: jumlah("hadir"),
      menitDibayar: jumlah("menitDibayar"),
      menitLembur: jumlah("menitLembur"),
      jumlahHari: 0, hari: [],
      upah: jumlah("upah"),
      menunggu: jumlah("menunggu"),
      sesi: perSesi,
      catatan: catatanCrew(fakta),
      // Fakta yang sama tanpa bahasa uang, untuk Panel kapten.
      catatanProgres: catatanProgresCrew(fakta),
    });
  }

  // Kapten di atas, lalu urut nama.
  hasil.sort(
    (a, b) => (a.peran === b.peran ? 0 : a.peran === "KAPTEN" ? -1 : 1) || String(a.user.name).localeCompare(String(b.user.name), "id")
  );

  const total = {
    orang: hasil.length,
    crew: hasil.filter((r) => r.peran === "CREW").length,
    kapten: hasil.filter((r) => r.peran === "KAPTEN").length,
    sesiDihadiri: hasil.reduce((t, r) => t + r.sesiDihadiri, 0),
    menitDibayar: hasil.reduce((t, r) => t + r.menitDibayar, 0),
    menitLembur: hasil.reduce((t, r) => t + r.menitLembur, 0),
    jumlahHari: hasil.reduce((t, r) => t + r.jumlahHari, 0),
    upah: hasil.reduce((t, r) => t + r.upah, 0),
    upahCrew: hasil.filter((r) => r.peran === "CREW").reduce((t, r) => t + r.upah, 0),
    upahKapten: hasil.filter((r) => r.peran === "KAPTEN").reduce((t, r) => t + r.upah, 0),
    menunggu: hasil.reduce((t, r) => t + r.menunggu, 0),
  };
  return { orang: hasil, total, sesi: sesiUrut };
}

// ---------- Teks catatan ----------

export function catatanCrew(n) {
  const c = [];
  if (n.masukDitolak) c.push(`Absen masuk ditolak di ${n.masukDitolak} sesi, sesi tersebut tidak dibayar`);
  if (n.tanpaMasuk) c.push(`Tidak ada absen masuk di ${n.tanpaMasuk} sesi`);
  if (n.tanpaPulang) c.push(`Tidak absen pulang di ${n.tanpaPulang} sesi`);
  if (n.pulangOtomatis) c.push(`Pulang dicatat sistem di ${n.pulangOtomatis} sesi`);
  if (n.menitTerpotong) c.push(`${fmtDurasi(n.menitTerpotong)} tidak dibayar karena absen progres terlambat atau terlewat`);
  if (n.berjalan) c.push(`${n.berjalan} sesi masih berlangsung`);
  return c;
}

// Catatan crew untuk Panel kapten: fakta yang sama dengan catatanCrew, tanpa bahasa uang.
export function catatanProgresCrew(n) {
  const c = [];
  if (n.masukDitolak) c.push(`Absen masuk ditolak di ${n.masukDitolak} sesi`);
  if (n.tanpaMasuk) c.push(`Tidak ada absen masuk di ${n.tanpaMasuk} sesi`);
  if (n.tanpaPulang) c.push(`Tidak absen pulang di ${n.tanpaPulang} sesi`);
  if (n.pulangOtomatis) c.push(`Pulang dicatat sistem di ${n.pulangOtomatis} sesi`);
  if (n.menitTerpotong) c.push(`${fmtDurasi(n.menitTerpotong)} tidak terhitung sebagai jam kerja karena absen progres terlambat atau terlewat`);
  if (n.berjalan) c.push(`${n.berjalan} sesi masih berlangsung`);
  return c;
}

export function catatanKapten(k) {
  const c = [];
  if (!k.jumlahHari) c.push("Belum ada absen masuk yang disahkan");
  if (k.masukDitolak) c.push(`${k.masukDitolak} absen masuk ditolak`);
  return c;
}

// Catatan untuk satu baris sesi di slip crew.
export function catatanSesi(r) {
  const c = [];
  if (r.masukDitolak) c.push("Absen masuk ditolak, sesi ini tidak dibayar.");
  if (r.tanpaMasuk) c.push("Tidak ada absen masuk, sesi ini tidak dibayar.");
  if (r.tanpaPulang) c.push("Tidak absen pulang, waktu sesudah absen terakhir tidak dibayar.");
  if (r.pulangOtomatis) c.push(r.pulang && sudahSah(r.pulang) ? "Pulang dicatat sistem dan telah disahkan." : "Pulang dicatat sistem dan belum disahkan.");
  if (r.menitTerpotong) c.push(`${fmtDurasi(r.menitTerpotong)} tidak dibayar karena absen progres terlambat atau terlewat.`);
  if (r.menunggu) c.push(`${r.menunggu} absen belum disahkan dan belum diperhitungkan.`);
  if (r.berjalan && r.hadir) c.push("Sesi masih berlangsung.");
  return c;
}

// ---------- Format tampilan ----------

const angkaId = new Intl.NumberFormat("id-ID");

// 1234500 -> "Rp 1.234.500"
export const fmtRupiah = (n) => `Rp ${angkaId.format(n)}`;
export const fmtAngka = (n) => angkaId.format(n);

// 450 -> "7 jam 30 menit", 480 -> "8 jam", 45 -> "45 menit"
export function fmtDurasi(menit) {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  if (!j) return `${m} menit`;
  return m ? `${j} jam ${m} menit` : `${j} jam`;
}

// "6281234564321" -> "0812****4321". Nomor pendek tetap disamarkan sebagian besar.
export function samarkanHp(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = `0${d.slice(2)}`;
  if (d.length >= 9) return `${d.slice(0, 4)}****${d.slice(-4)}`;
  if (d.length >= 5) return `${d.slice(0, 2)}****${d.slice(-2)}`;
  return "****";
}
