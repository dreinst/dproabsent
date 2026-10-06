import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Diagnosa: apakah env ada dan DB bisa dijangkau dari runtime Vercel.
export async function GET() {
  const out = {
    hasDbUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    db: "unknown",
  };
  try {
    const n = await prisma.user.count();
    out.db = "ok";
    out.users = n;
  } catch (e) {
    out.db = "error";
    out.error = String(e.message || e).slice(0, 300);
  }
  return NextResponse.json(out);
}
