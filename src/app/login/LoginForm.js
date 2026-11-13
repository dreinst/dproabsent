"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false); // owner dan superadmin masuk pakai nama

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Gagal masuk.");
        return;
      }
      router.replace(data.role === "CREW" ? "/" : "/admin");
      router.refresh();
    } catch {
      setErr("Jaringan bermasalah, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
      <label>{admin ? "Nama admin" : "Nomor HP"}</label>
      <input
        key={admin ? "nama" : "nomor"}
        type={admin ? "text" : "tel"}
        inputMode={admin ? "text" : "numeric"}
        placeholder={admin ? "Contoh: andrew" : "08xxxxxxxxxx"}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
      />
      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password dari kantor"
        autoComplete="current-password"
      />
      <div style={{ height: 16 }} />
      <button className="btn-primary" disabled={busy}>
        {busy ? "Memproses..." : "Masuk"}
      </button>
      <button type="button" className="btn-ghost btn-kecil" style={{ marginTop: 10 }} onClick={() => { setAdmin(!admin); setPhone(""); setErr(""); }}>
        {admin ? "Masuk sebagai crew" : "Masuk sebagai owner atau superadmin"}
      </button>
    </form>
  );
}
