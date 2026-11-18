-- Kapten per acara, pengaturan tarif upah, dan penanda pulang otomatis. Aman dijalankan ulang.
ALTER TABLE "Absensi" ADD COLUMN IF NOT EXISTS "otomatis" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "KaptenAcara" (
  "eventId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KaptenAcara_pkey" PRIMARY KEY ("eventId", "userId"),
  CONSTRAINT "KaptenAcara_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KaptenAcara_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "KaptenAcara_userId_idx" ON "KaptenAcara"("userId");

CREATE TABLE IF NOT EXISTS "Pengaturan" (
  "kunci" TEXT NOT NULL,
  "nilai" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pengaturan_pkey" PRIMARY KEY ("kunci")
);
INSERT INTO "Pengaturan" ("kunci", "nilai", "updatedAt") VALUES
  ('tarif_crew_per_jam', '15000', CURRENT_TIMESTAMP),
  ('tarif_kapten_per_hari', '200000', CURRENT_TIMESTAMP),
  ('jam_per_shift', '8', CURRENT_TIMESTAMP)
ON CONFLICT ("kunci") DO NOTHING;
