"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LABEL = { MASUK: "Absen masuk", CHECKPOINT: "Titik cek", PULANG: "Absen pulang" };

function badgeClass(status, insideRadius) {
  if (!insideRadius) return "bad";
  if (status === "TERLAMBAT") return "warn";
  if (status === "TIDAK_HADIR") return "bad";
  return "ok";
}

export default function AbsenPanel({ session, existing }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [kind, setKind] = useState(null); // aksi yang sedang dijalankan
  const [shot, setShot] = useState(null); // data URL foto
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const hasMasuk = existing.some((e) => e.kind === "MASUK");
  const hasPulang = existing.some((e) => e.kind === "PULANG");

  const actions = [];
  if (!hasMasuk) actions.push("MASUK");
  if (hasMasuk && !hasPulang && session.checkpointMinutes > 0) actions.push("CHECKPOINT");
  if (hasMasuk && !hasPulang) actions.push("PULANG");

  async function openCamera(k) {
    setErr(""); setOk(""); setShot(null); setKind(k);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setErr("Tidak bisa membuka kamera. Izinkan akses kamera di browser.");
      setKind(null);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const max = 800;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(v, 0, 0, w, h);
    setShot(canvas.toDataURL("image/jpeg", 0.7));
    stopCamera();
  }

  function cancel() {
    stopCamera();
    setKind(null); setShot(null); setErr("");
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("no-geo"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => reject(new Error("denied")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  async function send() {
    setErr(""); setBusy(true);
    try {
      const pos = await getPosition().catch(() => null);
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
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          photo: shot,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Gagal menyimpan absen."); return; }
      setOk(
        `${LABEL[kind]} tersimpan. Jarak ${data.distanceM} m` +
        (data.insideRadius ? " (di lokasi)." : " (di luar radius, ditandai).")
      );
      setKind(null); setShot(null);
      router.refresh();
    } catch {
      setErr("Jaringan bermasalah, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {existing.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {existing.map((e) => (
            <div className="meta" key={e.id} style={{ marginBottom: 4 }}>
              <b>{LABEL[e.kind]}</b> · {e.checkedAt} ·{" "}
              <span className={`badge ${badgeClass(e.status, e.insideRadius)}`}>{e.status}</span>{" "}
              {e.verified ? <span className="badge ok">sah</span> : <span className="badge muted">belum disahkan</span>}
              {e.note && <div className="note">{e.note}</div>}
            </div>
          ))}
        </div>
      )}

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
      {ok && <div className="ok-msg" style={{ marginBottom: 10 }}>{ok}</div>}

      {!kind && (
        <div className="row">
          {actions.length === 0 && !hasPulang && <span className="meta">Memuat aksi...</span>}
          {hasPulang && actions.length === 0 && <span className="meta">Sesi selesai. Absen lengkap.</span>}
          {actions.map((a) => (
            <button
              key={a}
              className={a === "PULANG" ? "btn-ghost grow" : "btn-primary grow"}
              onClick={() => openCamera(a)}
            >
              {LABEL[a]}
            </button>
          ))}
        </div>
      )}

      {kind && (
        <div>
          <p className="sub">{LABEL[kind]} untuk {session.eventName}. Ambil foto langsung, jangan dari galeri.</p>
          {!shot ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted />
              <div style={{ height: 10 }} />
              <div className="row">
                <button className="btn-primary grow" onClick={capture}>Jepret</button>
                <button className="btn-ghost" style={{ width: "auto" }} onClick={cancel}>Batal</button>
              </div>
            </>
          ) : (
            <>
              <img className="shot" src={shot} alt="Foto absen" />
              <div style={{ height: 10 }} />
              <div className="row">
                <button className="btn-ok grow" onClick={send} disabled={busy}>
                  {busy ? "Mengirim..." : "Kirim absen"}
                </button>
                <button className="btn-ghost" style={{ width: "auto" }} onClick={() => openCamera(kind)} disabled={busy}>
                  Ulang
                </button>
                <button className="btn-ghost" style={{ width: "auto" }} onClick={cancel} disabled={busy}>
                  Batal
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
