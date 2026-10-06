/** @type {import('next').NextConfig} */
const nextConfig = {
  // Foto absen disimpan sebagai data URL di DB, bisa cukup besar per request.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
