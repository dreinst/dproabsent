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

  return (
    <div className="row" style={{ marginTop: 10 }}>
      {!verified ? (
        <button className="btn-ok grow" onClick={() => act("sahkan")} disabled={busy}>Sahkan</button>
      ) : (
        <button className="btn-ghost grow" onClick={() => act("batal")} disabled={busy}>Batalkan sah</button>
      )}
      <button className="btn-bad" style={{ width: "auto" }} onClick={() => act("tolak")} disabled={busy}>
        Tolak
      </button>
    </div>
  );
}
