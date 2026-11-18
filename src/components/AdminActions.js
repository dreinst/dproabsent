"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Tombol untuk satu absen. Kalau dipakai di dalam foto besar, dialog ditutup setelah aksi berhasil.
export default function AdminActions({ id, verified, tutupDialog = false }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action, e) {
    const dlg = tutupDialog ? e.currentTarget.closest("dialog") : null;
    setBusy(true);
    try {
      await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      dlg?.close();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return <button className="btn-ghost btn-kecil" onClick={(e) => act("batal", e)} disabled={busy}>Batalkan pengesahan</button>;
  }
  return (
    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <button className="btn-primary btn-kecil" onClick={(e) => act("sahkan", e)} disabled={busy}>Sahkan</button>
      <button className="btn-bad btn-kecil" onClick={(e) => act("tolak", e)} disabled={busy}>Tolak</button>
    </div>
  );
}

// Mengesahkan semua absen belum sah di satu kartu dengan satu panggilan.
export function SahkanSemua({ ids }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function jalan() {
    setBusy(true);
    try {
      await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, action: "sahkan" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn-primary btn-kecil sahkan-semua" onClick={jalan} disabled={busy}>
      {busy ? "Mengesahkan..." : `Sahkan semua (${ids.length})`}
    </button>
  );
}
