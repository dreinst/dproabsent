"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function out() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <button className="btn-ghost" style={{ width: "auto" }} onClick={out}>
      Keluar
    </button>
  );
}
