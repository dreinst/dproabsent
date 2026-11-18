// Server produksi DPro Absen: beberapa proses Next.js dalam satu kontainer lewat node:cluster.
// Proses utama tidak merender apa pun. Tugasnya membagi koneksi ke worker secara round-robin
// dan menghidupkan ulang worker yang mati. Tiap worker menjalankan server Next lengkap di port yang sama.
//
// Pengaturan lewat env (bawaan dipilih untuk VPS 4 inti yang dipakai bersama, kontainer 2 GB):
//   WEB_CONCURRENCY      jumlah worker, bawaan 3
//   WORKER_HEAP_MB       batas heap V8 per worker (--max-old-space-size), bawaan 384
//   UV_THREADPOOL_SIZE   thread libuv per worker (scrypt login, sharp foto, fs), bawaan 2
//   CLUSTER_LAPOR_DETIK  kalau diisi, tiap worker mencatat jumlah koneksi dan permintaan per sekian detik
//
// Alasan angka bawaan:
// - 3 worker: render halaman, parsing JSON foto, dan olah hasil query jalan di thread utama tiap worker.
//   Tiga thread utama memakai tiga inti, satu inti tersisa untuk Postgres, proxy, dan kontainer lain.
// - Thread pool 2: scrypt (login) dan sharp (foto) jalan di thread pool. 3 x 2 = 6 thread sudah cukup
//   memenuhi 4 inti; lebih banyak hanya membuat thread utama kalah giliran CPU, dan tiap scrypt yang
//   sedang jalan memakan 16 MB.
// - Heap 384 MB: RSS puncak satu worker saat uji 200 crew di Mac sekitar 190 MB. Paling buruk 3 x (384 MB heap
//   + sekitar 150 MB di luar heap: Prisma, libvips, buffer foto, scrypt) + proses utama 50 MB, sekitar
//   1,65 GB, masih di bawah batas kontainer 2 GB.
// - Pool Prisma tetap bawaan (2 x jumlah inti fisik + 1 per worker): paling banyak 3 x 9 = 27 koneksi di VPS
//   4 inti, dan 54 saat Coolify menjalankan kontainer lama dan baru bersamaan. Di bawah max_connections 100.
import cluster from "node:cluster";
import http from "node:http";

process.env.NODE_ENV ??= "production";
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOSTNAME || "0.0.0.0";

const angka = (nilai, bawaan) => {
  const n = Number.parseInt(nilai, 10);
  return Number.isFinite(n) && n > 0 ? n : bawaan;
};

if (cluster.isPrimary) jalankanUtama();
else await jalankanWorker();

function jalankanUtama() {
  const jumlah = angka(process.env.WEB_CONCURRENCY, 3);
  const heapMb = angka(process.env.WORKER_HEAP_MB, 384);
  const threadPool = angka(process.env.UV_THREADPOOL_SIZE, 2);
  // Batas heap lama di NODE_OPTIONS dibuang supaya yang berlaku jatah per worker di atas.
  const opsiLain = (process.env.NODE_OPTIONS || "").replace(/--max-old-space-size=\S*/g, "").trim();
  const envWorker = {
    NODE_OPTIONS: `${opsiLain} --max-old-space-size=${heapMb}`.trim(),
    UV_THREADPOOL_SIZE: String(threadPool),
  };

  cluster.schedulingPolicy = cluster.SCHED_RR;
  console.log(
    `[utama ${process.pid}] ${jumlah} worker, heap ${heapMb} MB dan thread pool ${threadPool} per worker, port ${PORT}`
  );

  const hidup = new Map(); // worker.id -> waktu dibuat
  let berhenti = false;
  let gagalBeruntun = 0;

  const buat = () => {
    const w = cluster.fork(envWorker);
    hidup.set(w.id, Date.now());
  };
  for (let i = 0; i < jumlah; i++) buat();

  cluster.on("exit", (w, kode, sinyal) => {
    const umur = Date.now() - (hidup.get(w.id) ?? Date.now());
    hidup.delete(w.id);
    if (berhenti) {
      if (hidup.size === 0) process.exit(0);
      return;
    }
    // Worker yang mati cepat berturut-turut (misalnya build rusak) dihidupkan ulang makin jarang, paling lama 30 detik.
    gagalBeruntun = umur < 30000 ? gagalBeruntun + 1 : 0;
    const jeda = gagalBeruntun ? Math.min(30000, 1000 * 2 ** (gagalBeruntun - 1)) : 0;
    console.error(
      `[utama] worker ${w.process.pid} mati (kode ${kode ?? "-"}, sinyal ${sinyal ?? "-"}) setelah ${Math.round(umur / 1000)} dtk, dihidupkan ulang dalam ${jeda} ms`
    );
    setTimeout(() => {
      if (!berhenti) buat();
    }, jeda);
  });

  // Docker mengirim SIGTERM ke proses utama saja, jadi sinyal diteruskan ke tiap worker.
  // Worker menyelesaikan permintaan yang sedang jalan lalu keluar. Lewat 9 detik, dipaksa.
  const matikan = (sinyal) => {
    if (berhenti) return;
    berhenti = true;
    console.log(`[utama] ${sinyal} diterima, menghentikan ${hidup.size} worker`);
    if (hidup.size === 0) process.exit(0);
    for (const w of Object.values(cluster.workers)) w?.process.kill("SIGTERM");
    setTimeout(() => {
      for (const w of Object.values(cluster.workers)) w?.process.kill("SIGKILL");
      process.exit(0);
    }, 9000).unref();
  };
  process.on("SIGTERM", () => matikan("SIGTERM"));
  process.on("SIGINT", () => matikan("SIGINT"));
}

async function jalankanWorker() {
  // next dimuat sesudah NODE_ENV terisi.
  const { default: next } = await import("next");
  const app = next({ dev: false, hostname: HOST, port: PORT });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(`[worker ${process.pid}] galat menangani ${req.method} ${req.url}`, e);
      if (res.headersSent) res.destroy();
      else {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
  });
  server.listen(PORT, HOST, () => console.log(`[worker ${process.pid}] siap di http://${HOST}:${PORT}`));

  const lapor = angka(process.env.CLUSTER_LAPOR_DETIK, 0);
  if (lapor) {
    let koneksi = 0;
    let permintaan = 0;
    server.on("connection", () => koneksi++);
    server.on("request", () => permintaan++);
    setInterval(() => {
      if (koneksi || permintaan) {
        console.log(`[worker ${process.pid}] ${lapor} dtk terakhir: ${koneksi} koneksi, ${permintaan} permintaan`);
      }
      koneksi = permintaan = 0;
    }, lapor * 1000).unref();
  }

  // Berhenti menerima koneksi baru, tunggu permintaan yang sedang jalan, lalu keluar (paling lama 8 detik).
  let tutup = false;
  const berhenti = () => {
    if (tutup) return;
    tutup = true;
    setTimeout(() => process.exit(0), 8000).unref();
    server.close(() => {
      app.close().catch(() => {}).finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", berhenti);
  process.on("SIGINT", berhenti);
}
