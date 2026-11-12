"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { KIND, STATUS, nadaStatus } from "@/lib/label";
import { JEDA_MENIT, BATAS_MENIT } from "@/lib/aturan";

const LABEL = { MASUK: "Absen masuk", CHECKPOINT: "Absen titik cek", PULANG: "Absen pulang" };

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
  const [gps, setGps] = useState("cari"); // cari | ok | ditolak

  const hasMasuk = existing.some((e) => e.kind === "MASUK");
  const hasPulang = existing.some((e) => e.kind === "PULANG");
  const berjalan = hasMasuk && !hasPulang;

  // Hitung mundur ke titik cek berikutnya: 60 menit sejak absen terakhir, batas 5 menit.
  // Begitu jam selesai shift tiba, tombol berganti jadi absen pulang.
  const jatuhTempo = lastAt ? lastAt + JEDA_MENIT * 60000 : null;
  const batasAkhir = jatuhTempo ? jatuhTempo + BATAS_MENIT * 60000 : null;
  const shiftSelesai = berjalan && now >= session.endAt;
  let fase = "tunggu";
  if (jatuhTempo && now >= jatuhTempo) fase = now <= batasAkhir ? "saatnya" : "telat";

  // Satu tombol besar: label dan aksinya mengikuti tahap absen.
  let aksi = "MASUK";
  if (berjalan) aksi = shiftSelesai ? "PULANG" : "CHECKPOINT";
  // Detik berjalan hanya selama sesi crew ini sedang berlangsung.
  useEffect(() => {
    if (!berjalan) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [berjalan]);

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
      () => setGps("ditolak"),
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
          setErr("Tidak bisa membuka kamera. Izinkan akses kamera di browser.");
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
    setErr(""); setBusy(true);
    try {
      const pos = await ambilPosisi();
      if (!pos) {
        setErr("Lokasi tidak terbaca. Aktifkan GPS dan izinkan lokasi, lalu coba lagi.");
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
      if (!res.ok) { setErr(data.error || "Gagal menyimpan absen."); return; }
      setOk(
        `${LABEL[kind]} tersimpan` +
        (data.insideRadius ? "." : ` (di luar radius, ${data.distanceM} m dari titik).`)
      );
      setKind(null); setShot(null); setActivity("");
      setNow(Date.now());
      router.refresh();
    } catch {
      setErr("Jaringan bermasalah, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {gps === "ditolak" && !hasPulang && (
        <div className="err" style={{ marginBottom: 12 }}>
          Lokasi belum diizinkan. Aktifkan GPS dan izinkan lokasi di browser supaya absen bisa terkirim.
        </div>
      )}

      {berjalan && !shiftSelesai && (
        <div className={`hitung ${fase}`}>
          {fase === "tunggu" && (
            <>
              <span>Absen berikutnya</span>
              <b>{mmss(jatuhTempo - now)}</b>
            </>
          )}
          {fase === "saatnya" && (
            <>
              <span>Waktunya absen, sisa</span>
              <b>{mmss(batasAkhir - now)}</b>
            </>
          )}
          {fase === "telat" && (
            <>
              <span>Sudah lewat batas</span>
              <b>Absen sekarang</b>
            </>
          )}
        </div>
      )}

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {ok && <div className="ok-msg" style={{ margin: "10px 0" }}>{ok}</div>}

      {hasPulang ? (
        <div className="meta" style={{ margin: "8px 0" }}>Sesi selesai. Absen lengkap.</div>
      ) : (
        <div className="tumpuk">
          {shiftSelesai && <div className="hitung"><span>Shift sudah selesai</span><b>Waktunya pulang</b></div>}
          <button
            className={`tombol-besar ${aksi === "CHECKPOINT" && fase === "saatnya" ? "denyut" : ""}`}
            onClick={() => openCamera(aksi)}
            disabled={aksi === "CHECKPOINT" && fase === "tunggu"}
          >
            {LABEL[aksi]}
          </button>
        </div>
      )}

      {existing.length > 0 && (
        <details className="riwayat-sesi">
          <summary>Absen sesi ini ({existing.length})</summary>
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
                <span className={`badge ${e.insideRadius ? nadaStatus(e.status) : "bad"}`}>
                  {e.insideRadius ? STATUS[e.status] : "Luar radius"}
                </span>
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
              <span className="kaca">{KIND[kind]} · {session.jobdesc}</span>
              {!shot ? (
                <button
                  className="kaca-tombol"
                  onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                >
                  Balik
                </button>
              ) : <span style={{ width: 64 }} />}
            </div>
          </div>

          {!shot ? (
            <div className="kamera-bawah">
              <button className="shutter" onClick={capture} aria-label="Ambil foto" />
              <p>Foto langsung dari kamera. Lokasi diambil otomatis.</p>
            </div>
          ) : (
            <div className="kamera-bawah form">
              <input
                type="text"
                placeholder="Lagi ngapain? Contoh: pasang rigging panggung"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                maxLength={300}
                autoFocus
              />
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
