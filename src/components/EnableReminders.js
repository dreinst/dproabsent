"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function EnableReminders({ vapidPublic }) {
  const [state, setState] = useState("idle"); // idle|on|unsupported|ios-install|busy|error
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
    if (!supported) {
      if (isIOS && !standalone) { setState("ios-install"); return; }
      setState("unsupported"); return;
    }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.pushManager.getSubscription().then((sub) => { if (sub) setState("on"); });
      });
    }
  }, []);

  async function enable() {
    if (!vapidPublic) { setState("error"); setMsg("Kunci push belum dipasang di server."); return; }
    setState("busy"); setMsg("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("error"); setMsg("Izin notifikasi ditolak."); return; }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublic),
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) { setState("error"); setMsg("Gagal menyimpan langganan."); return; }
      setState("on");
    } catch (e) {
      setState("error"); setMsg("Tidak bisa mengaktifkan pengingat.");
    }
  }

  if (state === "unsupported") {
    return <div className="meta">Browser ini belum mendukung notifikasi push.</div>;
  }
  if (state === "ios-install") {
    return (
      <div className="meta">
        Untuk notifikasi di iPhone: buka lewat Safari, tekan tombol Bagikan, pilih
        <b> Tambah ke Layar Utama</b>, lalu buka dari ikon itu dan aktifkan pengingat.
      </div>
    );
  }
  if (state === "on") {
    return <div className="ok-msg">Pengingat absen aktif di perangkat ini.</div>;
  }
  return (
    <div>
      <button className="btn-ghost" style={{ width: "auto" }} onClick={enable} disabled={state === "busy"}>
        {state === "busy" ? "Mengaktifkan..." : "Aktifkan pengingat di HP"}
      </button>
      {msg && <div className="note">{msg}</div>}
    </div>
  );
}
