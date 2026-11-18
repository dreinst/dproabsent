// Uji beban DPro Absen: N crew virtual login lalu absen hampir bersamaan.
// Tiap crew mulai di detik acak antara 0 dan --ramp, lalu menjalankan berurutan:
//   1. POST /api/login         (nomor 62899xxxxxxx dan password dari siapkan.mjs)
//   2. GET  /                  (halaman crew, memakai cookie dari login)
//   3. POST /api/absen         (MASUK, foto JPEG unik, koordinat di dalam radius)
// Tiap crew memakai satu koneksi keep-alive sendiri, seperti satu HP.
//
//   node scripts/uji-beban/jalankan.mjs --url=http://127.0.0.1:3000 --n=200 --ramp=10
//
// Tanpa dependensi npm (node:http dan node:https). Keluaran: tabel per langkah dan satu baris JSON.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values: opsi } = parseArgs({
  options: {
    url: { type: "string", default: "http://127.0.0.1:3000" },
    n: { type: "string", default: "50" },
    ramp: { type: "string", default: "10" },
    awal: { type: "string", default: "1" },
    password: { type: "string", default: "ujibeban123" },
    sesi: { type: "string", default: "900001" },
    lat: { type: "string", default: "-7.96662" },
    lng: { type: "string", default: "112.63263" },
    foto: { type: "string", default: fileURLToPath(new URL("./foto-dasar.jpg", import.meta.url)) },
    batas: { type: "string", default: "60" },
  },
});

const DASAR = new URL(opsi.url);
const N = Number(opsi.n);
const RAMP_MS = Number(opsi.ramp) * 1000;
const AWAL = Number(opsi.awal);
const SESI = Number(opsi.sesi);
const LAT = Number(opsi.lat);
const LNG = Number(opsi.lng);
const BATAS_MS = Number(opsi.batas) * 1000;
if (![N, AWAL, SESI].every((x) => Number.isInteger(x) && x > 0)) throw new Error("--n, --awal, --sesi harus bilangan bulat positif");
if (![RAMP_MS, LAT, LNG, BATAS_MS].every(Number.isFinite)) throw new Error("--ramp, --lat, --lng, --batas harus angka");

const lib = DASAR.protocol === "https:" ? https : http;
const fotoDasar = readFileSync(opsi.foto);
if (fotoDasar[0] !== 0xff || fotoDasar[1] !== 0xd8) throw new Error(`${opsi.foto} bukan JPEG (tidak diawali SOI)`);

// Foto unik: segmen COM (FF FE) berisi 32 byte acak disisipkan tepat setelah SOI.
// Hash foto jadi berbeda, tapi gambarnya tetap JPEG utuh yang benar-benar diolah sharp di server.
function fotoUnik() {
  const isi = randomBytes(32);
  const kepala = Buffer.from([0xff, 0xfe, 0, 0]);
  kepala.writeUInt16BE(isi.length + 2, 2);
  const jpg = Buffer.concat([fotoDasar.subarray(0, 2), kepala, isi, fotoDasar.subarray(2)]);
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

// Satu permintaan HTTP dengan batas waktu total. Hasil: { status, ms, headers, body } atau { galat, ms }.
function minta(agent, method, path, headers = {}, body) {
  return new Promise((selesai) => {
    const t0 = performance.now();
    let beres = false;
    let timer;
    const akhiri = (hasil) => {
      if (beres) return;
      beres = true;
      clearTimeout(timer);
      selesai({ ...hasil, ms: performance.now() - t0 });
    };
    const isi = body === undefined ? undefined : Buffer.from(body);
    const req = lib.request(new URL(path, DASAR), {
      method,
      agent,
      headers: { ...headers, ...(isi ? { "content-length": isi.length } : {}) },
    });
    timer = setTimeout(() => {
      req.destroy();
      akhiri({ galat: "BATAS_WAKTU" });
    }, BATAS_MS);
    req.on("response", (res) => {
      const potong = [];
      res.on("data", (c) => potong.push(c));
      res.on("end", () => akhiri({ status: res.statusCode, headers: res.headers, body: Buffer.concat(potong) }));
      res.on("error", (e) => akhiri({ galat: e.code || e.message }));
    });
    req.on("error", (e) => akhiri({ galat: e.code || e.message }));
    req.end(isi);
  });
}

const LANGKAH = ["login", "halaman", "absen"];
const catatan = Object.fromEntries(LANGKAH.map((l) => [l, { ms: [], kode: {}, contoh: new Set() }]));
let lengkap = 0;
let selesaiCrew = 0;

function catat(langkah, h, ok) {
  const c = catatan[langkah];
  const kode = h.galat ?? String(h.status);
  c.kode[kode] = (c.kode[kode] || 0) + 1;
  if (h.status) c.ms.push(h.ms);
  if (!ok && c.contoh.size < 3) {
    const pesan = h.galat ?? `${h.status} ${String(h.body || "").slice(0, 160).replace(/\s+/g, " ")}`;
    c.contoh.add(pesan);
  }
  return ok;
}

async function crew(i, tunda) {
  await new Promise((r) => setTimeout(r, tunda));
  const agent = new lib.Agent({ keepAlive: true, maxSockets: 1 });
  try {
    const phone = `62899${String(i).padStart(7, "0")}`;
    const json = { "content-type": "application/json" };
    const masuk = await minta(agent, "POST", "/api/login", json, JSON.stringify({ phone, password: opsi.password }));
    const cookie = (masuk.headers?.["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
    if (!catat("login", masuk, masuk.status === 200 && cookie !== "")) return;

    const halaman = await minta(agent, "GET", "/", { cookie });
    if (!catat("halaman", halaman, halaman.status === 200)) return;

    // Titik acak sekitar 0 sampai 50 m dari titik acara (radius acara uji 300 m).
    const lat = LAT + (Math.random() - 0.5) * 0.0009;
    const lng = LNG + (Math.random() - 0.5) * 0.0009;
    const body = JSON.stringify({ sessionId: SESI, kind: "MASUK", lat, lng, accuracyM: 12, activity: "uji beban", photo: fotoUnik() });
    const absen = await minta(agent, "POST", "/api/absen", { ...json, cookie }, body);
    let ok = absen.status === 200;
    if (ok) {
      try {
        ok = JSON.parse(absen.body).ok === true;
      } catch {
        ok = false;
      }
    }
    if (catat("absen", absen, ok)) lengkap++;
  } finally {
    agent.destroy();
    selesaiCrew++;
  }
}

const persen = (urut, p) => (urut.length ? urut[Math.min(urut.length - 1, Math.ceil(p * urut.length) - 1)] : 0);

function ringkas(langkah) {
  const c = catatan[langkah];
  const urut = [...c.ms].sort((a, b) => a - b);
  return {
    total: Object.values(c.kode).reduce((a, b) => a + b, 0),
    kode: c.kode,
    p50: Math.round(persen(urut, 0.5)),
    p95: Math.round(persen(urut, 0.95)),
    p99: Math.round(persen(urut, 0.99)),
    maks: Math.round(urut.at(-1) ?? 0),
    contoh: [...c.contoh],
  };
}

console.log(`uji-beban ${new Date().toISOString()} url=${DASAR.origin} n=${N} ramp=${opsi.ramp}s crew=${AWAL}..${AWAL + N - 1} sesi=${SESI}`);
const t0 = performance.now();
const pantau = setInterval(() => {
  console.error(`  ${((performance.now() - t0) / 1000).toFixed(0)} dtk: ${selesaiCrew}/${N} crew selesai`);
}, 5000);
await Promise.all(Array.from({ length: N }, (_, k) => crew(AWAL + k, Math.random() * RAMP_MS)));
clearInterval(pantau);
const totalDetik = (performance.now() - t0) / 1000;

const hasil = { waktu: new Date().toISOString(), url: DASAR.origin, n: N, ramp: Number(opsi.ramp), total_detik: Number(totalDetik.toFixed(1)), lengkap };
console.log("");
console.log("langkah    jumlah  kode status                 p50     p95     p99    maks  (ms)");
for (const l of LANGKAH) {
  const r = ringkas(l);
  hasil[l] = { kode: r.kode, p50: r.p50, p95: r.p95, p99: r.p99, maks: r.maks };
  const kode = Object.entries(r.kode).map(([k, v]) => `${k}:${v}`).join(" ") || "-";
  console.log(
    `${l.padEnd(9)} ${String(r.total).padStart(7)}  ${kode.padEnd(22)} ${String(r.p50).padStart(6)}  ${String(r.p95).padStart(6)}  ${String(r.p99).padStart(6)}  ${String(r.maks).padStart(6)}`
  );
  for (const c of r.contoh) console.log(`           contoh gagal: ${c}`);
}
console.log(`lengkap ${lengkap}/${N} crew, total ${totalDetik.toFixed(1)} dtk`);
console.log(`JSON ${JSON.stringify(hasil)}`);
process.exitCode = lengkap === N ? 0 : 1;
