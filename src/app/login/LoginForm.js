"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BantuanWa from "@/components/BantuanWa";

export default function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  // Status HTTP galat terakhir, untuk memilih tombol bantuan.
  const [kode, setKode] = useState(0);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setKode(0);
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
        setKode(res.status);
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
      {err && (
        <div className="err" style={{ marginBottom: 10 }}>
          {err}
          {kode === 401 && <BantuanWa jenis={["belum", "password"]} />}
          {kode === 429 && <BantuanWa jenis={["lain"]} />}
        </div>
      )}
      {/* Satu kolom untuk semua akun: crew mengisi nomor HP, owner dan superadmin mengisi nama. Server yang membedakannya. */}
      <label>Nomor HP atau nama admin</label>
      <input
        type="text"
        placeholder="08xxxxxxxxxx"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
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
    </form>
  );
}
