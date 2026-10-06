import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

// Akun demo (BUKAN data crew asli). Aman untuk preview publik.
const USERS = [
  { name: "Owner D'Pro", phone: "628000000001", role: "OWNER", pwd: "owner123" },
  { name: "Andrew (Superadmin)", phone: "628000000002", role: "SUPERADMIN", pwd: "super123" },
  { name: "Crew Satu", phone: "628000000011", role: "CREW", pwd: "crew123" },
  { name: "Crew Dua", phone: "628000000012", role: "CREW", pwd: "crew123" },
];

async function main() {
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: { name: u.name, role: u.role },
      create: { name: u.name, phone: u.phone, role: u.role, passwordHash: hashPassword(u.pwd) },
    });
  }

  const name = "Demo Event Malang";
  let event = await prisma.event.findFirst({ where: { name } });
  if (!event) {
    const now = Date.now();
    event = await prisma.event.create({
      data: {
        name,
        client: "Internal (demo)",
        lat: -7.966620, // sekitar pusat kota Malang
        lng: 112.632629,
        radiusM: 150,
        startAt: new Date(now - 60 * 60000),
        endAt: new Date(now + 8 * 3600000),
        sessions: {
          create: [
            {
              jobdesc: "Loading",
              startAt: new Date(now - 5 * 60000), // baru mulai, absen sekarang masih HADIR
              endAt: new Date(now + 5 * 3600000),
              checkpointMinutes: 90,
              graceMinutes: 15,
            },
            {
              jobdesc: "Event",
              startAt: new Date(now + 60 * 60000),
              endAt: new Date(now + 6 * 3600000),
              checkpointMinutes: 0,
              graceMinutes: 15,
            },
          ],
        },
      },
    });
  }

  console.log("Seed selesai. Event:", event.name);
  console.log("Login demo:");
  for (const u of USERS) console.log(`  ${u.role.padEnd(10)} ${u.phone} / ${u.pwd}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
