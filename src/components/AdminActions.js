"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Kirim aksi ke /api/verify. Hasilnya pesan galat dari server, atau "" kalau berhasil.
async function kirim(isi) {
  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isi),
    });
    if (res.ok) return "";
    const data = await res.json().catch(() => ({}));
    return data.error || "Perubahan gagal disimpan. Silakan coba lagi.";
  } catch {
    return "Koneksi internet bermasalah. Silakan coba lagi.";
  }
}

// Tombol untuk satu absen. Kalau dipakai di dalam foto besar, dialog ditutup setelah aksi berhasil.
// Kalau ditolak server (misalnya bukan wewenang kapten), pesannya tampil di bawah tombol dan dialog tetap terbuka.
export default function AdminActions({ id, verified, tutupDialog = false }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function act(action, e) {
    const dlg = tutupDialog ? e.currentTarget.closest("dialog") : null;
    setBusy(true);
    setErr("");
    try {
      const pesan = await kirim({ id, action });
      if (pesan) {
        setErr(pesan);
        return;
      }
      dlg?.close();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const galat = err && <p className="aksi-galat" role="alert">{err}</p>;
  if (verified) {
    return (
      <>
        <button className="btn-ghost btn-kecil" onClick={(e) => act("batal", e)} disabled={busy}>Batalkan pengesahan</button>
        {galat}
      </>
    );
  }
  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <button className="btn-primary btn-kecil" onClick={(e) => act("sahkan", e)} disabled={busy}>Sahkan</button>
        <button className="btn-bad btn-kecil" onClick={(e) => act("tolak", e)} disabled={busy}>Tolak</button>
      </div>
      {galat}
    </>
  );
}

// Mengesahkan semua absen belum sah di satu kartu dengan satu panggilan.
export function SahkanSemua({ ids }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function jalan() {
    setBusy(true);
    setErr("");
    try {
      const pesan = await kirim({ ids, action: "sahkan" });
      if (pesan) setErr(pesan);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-primary btn-kecil sahkan-semua" onClick={jalan} disabled={busy}>
        {busy ? "Mengesahkan..." : `Sahkan semua (${ids.length})`}
      </button>
      {err && <p className="aksi-galat" role="alert">{err}</p>}
    </>
  );
}
