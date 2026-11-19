import { PrismaClient } from "@prisma/client";

// Satu PrismaClient per proses, juga di produksi. Next bisa memuat modul ini lebih dari sekali dalam satu proses
// (bundel instrumentation untuk pulang otomatis memakai salinan modul sendiri). Tanpa globalThis,
// tiap salinan membuat klien dan pool koneksi database baru.
const globalForPrisma = globalThis;

export const prisma = (globalForPrisma.prisma ??= new PrismaClient());
