"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminActions({ id, verified }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action) {
    setBusy(true);
    try {
      await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return <button className="btn-ghost btn-kecil" onClick={() => act("batal")} disabled={busy}>Batalkan sah</button>;
  }
  return (
    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <button className="btn-primary btn-kecil" onClick={() => act("sahkan")} disabled={busy}>Sahkan</button>
      <button className="btn-bad btn-kecil" onClick={() => act("tolak")} disabled={busy}>Tolak</button>
    </div>
  );
}
