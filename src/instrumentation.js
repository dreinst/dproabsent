// Dipanggil Next sekali per proses server saat server mulai, jadi sekali di setiap worker cluster (server.mjs).
// Pekerjaan latar hanya jalan di runtime Node.js. Kegagalannya hanya dicatat, supaya server tetap bisa hidup.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { mulaiPulangOtomatis } = await import("./lib/pulang-otomatis");
      mulaiPulangOtomatis();
    } catch (e) {
      console.error(`[pulang-otomatis ${process.pid}] gagal dimulai: ${e?.message || e}`);
    }
  }
}
