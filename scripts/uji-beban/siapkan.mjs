// Menghasilkan SQL untuk mengisi database UJI (skema sudah ada, isinya kosong) sebelum uji beban:
//   - N crew uji bernomor 62899xxxxxxx dengan satu password yang sama,
//   - 1 acara aktif (id 900001) dengan titik lokasi,
//   - 1 sesi (id 900001) yang sedang berjalan: mulai 5 menit lalu, selesai 6 jam lagi.
// Waktu sesi dihitung oleh Postgres saat SQL dijalankan, jadi SQL yang sama bisa dipakai ulang.
// SQL menolak jalan kalau database berisi akun selain akun uji, supaya tidak salah isi database asli.
//
//   node scripts/uji-beban/siapkan.mjs --n=500 > /tmp/siapkan.sql
//   psql -v ON_ERROR_STOP=1 -d <database_uji> -f /tmp/siapkan.sql
//
// Tanpa dependensi npm. Format hash sama dengan src/lib/password.js: scrypt$<salt hex>$<hash hex>.
import { randomBytes, scryptSync } from "node:crypto";
import { parseArgs } from "node:util";

const { values: opsi } = parseArgs({
  options: {
    n: { type: "string", default: "500" },
    password: { type: "string", default: "ujibeban123" },
    lat: { type: "string", default: "-7.96662" },
    lng: { type: "string", default: "112.63263" },
    radius: { type: "string", default: "300" },
  },
});

const n = Number(opsi.n);
const lat = Number(opsi.lat);
const lng = Number(opsi.lng);
const radius = Number(opsi.radius);
if (!Number.isInteger(n) || n < 1 || n > 9_999_999) throw new Error("--n harus bilangan bulat 1 sampai 9999999");
if (![lat, lng, radius].every(Number.isFinite)) throw new Error("--lat, --lng, dan --radius harus angka");

// Hash dibuat sekali lalu dipakai semua crew uji (parameter scrypt bawaan Node, sama dengan aplikasi).
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("hex")}$${scryptSync(opsi.password, salt, 64).toString("hex")}`;
const UTC = `(now() AT TIME ZONE 'UTC')`; // kolom timestamp tanpa zona menyimpan waktu UTC (cara Prisma)

process.stdout.write(`-- Dibuat oleh scripts/uji-beban/siapkan.mjs: ${n} crew uji. HANYA untuk database uji.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE phone NOT LIKE '62899%') THEN
    RAISE EXCEPTION 'Database ini berisi akun selain akun uji 62899... Uji beban hanya boleh memakai database uji.';
  END IF;
END $$;

INSERT INTO "User" (name, phone, "passwordHash", role, active)
SELECT 'Crew Uji ' || i, '62899' || lpad(i::text, 7, '0'), '${hash}', 'CREW', true
FROM generate_series(1, ${n}) AS i
ON CONFLICT (phone) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", active = true;

INSERT INTO "Event" (id, name, client, lat, lng, "radiusM", "startAt", "endAt", active)
VALUES (900001, 'Uji Beban', 'Uji', ${lat}, ${lng}, ${radius}, ${UTC} - interval '1 hour', ${UTC} + interval '1 day', true)
ON CONFLICT (id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, "radiusM" = EXCLUDED."radiusM",
  "startAt" = EXCLUDED."startAt", "endAt" = EXCLUDED."endAt", active = true;

INSERT INTO "Session" (id, "eventId", jobdesc, "startAt", "endAt", "checkpointMinutes", "graceMinutes")
VALUES (900001, 900001, 'Uji Beban', ${UTC} - interval '5 minutes', ${UTC} + interval '6 hours', 60, 15)
ON CONFLICT (id) DO UPDATE SET "startAt" = EXCLUDED."startAt", "endAt" = EXCLUDED."endAt";

COMMIT;

SELECT count(*) AS crew_uji FROM "User" WHERE phone LIKE '62899%';
`);
