"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { KIND, STATUS, nadaStatus } from "@/lib/label";
import { BATAS_MENIT } from "@/lib/aturan";

const LABEL = { MASUK: "Absen masuk", CHECKPOINT: "Absen progres", PULANG: "Absen pulang" };

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function AbsenPanel({ session, existing, lastAt }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const posRef = useRef(null); // posisi terbaru dari GPS yang dipantau di latar
  const [kind, setKind] = useState(null); // aksi yang sedang dijalankan
  const [facing, setFacing] = useState("environment");
  const [shot, setShot] = useState(null); // data URL foto
  const [activity, setActivity] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [gps, setGps] = useState("cari"); // cari | ok | ditolak | gagal

  const hasMasuk = existing.some((e) => e.kind === "MASUK");
  const hasPulang = existing.some((e) => e.kind === "PULANG");
  // Pulang dicatat sistem karena crew tidak absen pulang sampai 1 jam setelah sesi selesai.
  const pulangOtomatis = existing.some((e) => e.kind === "PULANG" && e.otomatis);
  const berjalan = hasMasuk && !hasPulang;

  // Hitung mundur ke titik cek berikutnya: jarak sesi (session.jedaMenit) sejak absen terakhir, lalu batas BATAS_MENIT.
  // Begitu jam selesai shift tiba, tombol berganti jadi absen pulang.
  const jatuhTempo = lastAt ? Math.max(lastAt, session.startAt) + session.jedaMenit * 60000 : null;
  const batasAkhir = jatuhTempo ? jatuhTempo + BATAS_MENIT * 60000 : null;
  const shiftSelesai = berjalan && now >= session.endAt;
  let fase = "tunggu";
  if (jatuhTempo && now >= jatuhTempo) fase = now <= batasAkhir ? "saatnya" : "telat";

  // Absen masuk dibuka sebelum jam mulai sesi (session.bukaAt). Server juga menolak absen masuk sebelum itu.
  // Satu jam terakhir sebelum dibuka ditampilkan sebagai hitung mundur.
  const belumDibuka = !hasMasuk && now < session.bukaAt;
  const dekatBuka = belumDibuka && session.bukaAt - now <= 3600000;

  // Satu tombol besar: label dan aksinya mengikuti tahap absen.
  let aksi = "MASUK";
  if (berjalan) aksi = shiftSelesai ? "PULANG" : "CHECKPOINT";
  // Detik berjalan selama sesi crew ini berlangsung dan dalam satu jam sebelum absen masuk dibuka.
  // Sebelum itu cukup diperiksa tiap 30 detik.
  useEffect(() => {
    if (!berjalan && !belumDibuka) return;
    const t = setInterval(() => setNow(Date.now()), berjalan || dekatBuka ? 1000 : 30000);
    return () => clearInterval(t);
  }, [berjalan, belumDibuka, dekatBuka]);

  // Begitu absen masuk dibuka, muat ulang data halaman supaya label sesi ikut menjadi "Absen masuk dibuka".
  // Jedanya acak sampai 20 detik supaya ratusan HP tidak memuat ulang pada detik yang sama.
  const tadiBelumDibuka = useRef(belumDibuka);
  useEffect(() => {
    const tadi = tadiBelumDibuka.current;
    tadiBelumDibuka.current = belumDibuka;
    if (!tadi || belumDibuka) return;
    const t = setTimeout(() => router.refresh(), Math.random() * 20000);
    return () => clearTimeout(t);
  }, [belumDibuka, router]);

  // Lokasi dipantau di latar supaya sudah siap saat tombol kirim ditekan.
  useEffect(() => {
    if (hasPulang || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        posRef.current = {
          lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: Date.now(),
        };
        setGps("ok");
      },
      // Hanya kode 1 yang berarti izin ditolak. Kode 2 dan 3 (posisi belum tersedia atau terlalu lama) sering terjadi
      // di dalam ruangan walaupun izinnya sudah diberikan, dan pemantauan tetap mencoba lagi.
      (e) => setGps(e.code === 1 ? "ditolak" : "gagal"),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [hasPulang]);

  // Buka kamera lewat efek supaya elemen <video> sudah ada saat stream dipasang.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!kind || shot) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setErr("Kamera tidak dapat dibuka. Mohon izinkan akses kamera di browser.");
          setKind(null);
        }
      }
    }
    start();
    return () => { cancelled = true; stopCamera(); };
  }, [kind, shot, facing]);

  // Layar penuh: kunci gulir halaman di belakang selama kamera terbuka.
  useEffect(() => {
    if (!kind) return;
    const awal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = awal; };
  }, [kind]);

  function openCamera(k) {
    setErr(""); setOk(""); setShot(null); setActivity(""); setKind(k);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const max = 720;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(v, 0, 0, w, h);
    setShot(canvas.toDataURL("image/jpeg", 0.65));
    stopCamera();
  }

  function cancel() {
    stopCamera();
    setKind(null); setShot(null); setErr("");
  }

  // Pakai posisi dari pemantauan latar kalau masih segar, kalau tidak minta satu kali.
  function ambilPosisi() {
    const p = posRef.current;
    if (p && Date.now() - p.t < 120000) return Promise.resolve(p);
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  async function send() {
    if (!activity.trim()) {
      setErr("Mohon isi kolom \"Yang dikerjakan\" terlebih dahulu.");
      return;
    }
    setErr(""); setBusy(true);
    try {
      const pos = await ambilPosisi();
      if (!pos) {
        setErr("Lokasi tidak terbaca. Mohon aktifkan GPS dan izinkan akses lokasi, lalu coba lagi.");
        return;
      }
      const res = await fetch("/api/absen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          kind,
          lat: pos.lat,
          lng: pos.lng,
          accuracyM: pos.acc,
          activity,
          photo: shot,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Absen gagal disimpan. Silakan coba lagi."); return; }
      setOk(
        `${LABEL[kind]} berhasil disimpan.` +
        (data.insideRadius ? "" : ` Posisi Anda di luar radius, ${data.distanceM} m dari titik acara.`)
      );
      setKind(null); setShot(null); setActivity("");
      setNow(Date.now());
      router.refresh();
    } catch {
      setErr("Koneksi internet bermasalah. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absen-panel">
      {gps === "ditolak" && !hasPulang && (
        <div className="err" style={{ marginBottom: 12 }}>
          Akses lokasi belum diizinkan. Mohon aktifkan GPS dan izinkan akses lokasi di browser agar absen dapat terkirim.
          <br />Di iPhone: buka Pengaturan, Privasi &amp; Keamanan, Layanan Lokasi, Situs Web Safari, pilih Saat Menggunakan App.
          Lalu muat ulang halaman ini dan tekan Izinkan.
        </div>
      )}
      {gps === "gagal" && !hasPulang && (
        <div className="err" style={{ marginBottom: 12 }}>
          Lokasi belum terbaca. Pastikan GPS menyala, dekati jendela atau area terbuka, lalu tunggu sebentar.
        </div>
      )}

      {berjalan && !shiftSelesai && (
        <div className={`hitung ${fase}`}>
          {fase === "tunggu" && (
            <>
              <span>Absen progres berikutnya</span>
              <b>{mmss(jatuhTempo - now)}</b>
            </>
          )}
          {fase === "saatnya" && (
            <>
              <span>Saatnya absen progres, sisa waktu</span>
              <b>{mmss(batasAkhir - now)}</b>
            </>
          )}
          {fase === "telat" && (
            <>
              <span>Batas waktu absen progres terlewati</span>
              <b>Silakan absen sekarang</b>
            </>
          )}
        </div>
      )}

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {ok && <div className="ok-msg" style={{ margin: "10px 0" }}>{ok}</div>}

      {hasPulang ? (
        pulangOtomatis ? (
          <div className="pulang-otomatis">Anda tidak melakukan absen pulang. Pulang dicatat otomatis.</div>
        ) : (
          <div className="meta" style={{ margin: "8px 0" }}>Sesi selesai. Absen Anda sudah lengkap.</div>
        )
      ) : (
        <div className="tumpuk">
          {shiftSelesai && <div className="hitung pulang"><span>Shift telah selesai</span><b>Silakan absen pulang</b></div>}
          {belumDibuka && (
            dekatBuka ? (
              <div className="hitung tunggu"><span>Absen masuk dibuka dalam</span><b suppressHydrationWarning>{mmss(session.bukaAt - now)}</b></div>
            ) : (
              <div className="hitung mulai"><span>Absen masuk dibuka pada</span><b>{session.bukaTeks} WIB</b></div>
            )
          )}
          <button
            className={`tombol-besar ${aksi === "CHECKPOINT" && fase === "saatnya" ? "denyut" : ""}`}
            onClick={() => openCamera(aksi)}
            disabled={belumDibuka || (aksi === "CHECKPOINT" && fase === "tunggu")}
          >
            {LABEL[aksi]}
          </button>
        </div>
      )}

      {existing.length > 0 && (
        <details className="riwayat-sesi">
          <summary>Riwayat absen sesi ini ({existing.length})</summary>
          {existing.map((e) => (
            <div key={e.id}>
              <div className="absen-baris">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb kecil" loading="lazy" src={`/api/foto/${e.id}`} alt={`Foto ${KIND[e.kind]}`} />
                <div className="grow">
                  <div className="tebal" style={{ fontSize: 14 }}>{KIND[e.kind]}</div>
                  <div className="meta" style={{ fontSize: 12 }}>
                    {e.checkedAt}
                    {e.activity ? ` · ${e.activity}` : ""}
                  </div>
                </div>
                {e.otomatis ? (
                  <span className="badge warn">Tidak absen pulang</span>
                ) : (
                  <span className={`badge ${e.insideRadius ? nadaStatus(e.status) : "bad"}`}>
                    {e.insideRadius ? STATUS[e.status] : "Di luar radius"}
                  </span>
                )}
              </div>
              {e.note && <div className="note" style={{ margin: "-2px 0 8px" }}>{e.note}</div>}
            </div>
          ))}
        </details>
      )}

      {kind && (
        <div className="layar-kamera">
          <div className="kamera-media">
            {!shot ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video ref={videoRef} playsInline muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot} alt="Foto absen" />
            )}
            <div className="kamera-atas">
              <button className="kaca-tombol" onClick={cancel} disabled={busy}>Batal</button>
              {!shot && (
                <button
                  className="kaca-tombol"
                  onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                >
                  Ganti kamera
                </button>
              )}
            </div>
            {/* Label di baris sendiri supaya nama tugas yang panjang tidak terpotong oleh tombol. */}
            <span className="kaca kamera-label">{LABEL[kind]} · {session.jobdesc}</span>
          </div>

          {!shot ? (
            <div className="kamera-bawah">
              <button className="shutter" onClick={capture} aria-label="Ambil foto" />
              <p>Foto diambil langsung dari kamera. Lokasi tercatat otomatis.</p>
            </div>
          ) : (
            <div className="kamera-bawah form">
              <label className="kamera-isian">
                Yang dikerjakan
                <input
                  type="text"
                  placeholder="Contoh: Memasang rigging panggung"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  maxLength={300}
                  required
                  autoFocus
                />
              </label>
              {err && <div className="err">{err}</div>}
              <button className="tombol-besar" onClick={send} disabled={busy}>
                {busy ? "Mengirim..." : "Kirim"}
              </button>
              <button className="btn-ghost" onClick={() => setShot(null)} disabled={busy}>Foto ulang</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
