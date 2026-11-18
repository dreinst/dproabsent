# DPro Absen: build Next.js untuk Coolify di VPS.
FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build && chown -R node:node .next
# Foto absen disimpan sebagai berkas di volume /data/fotos (dipasang dari Coolify).
# Foldernya dibuat di image supaya volume baru ikut dimiliki user node.
RUN mkdir -p /data/fotos && chown -R node:node /data
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 FOTO_DIR=/data/fotos
# server.mjs menjalankan beberapa worker Next (node:cluster) di port 3000. Angkanya untuk kontainer 2 GB
# di VPS 4 inti yang dipakai bersama: 3 worker x heap 384 MB, thread pool libuv 2 per worker.
# Batas heap dipasang server.mjs lewat NODE_OPTIONS masing-masing worker. Alasannya ada di server.mjs.
ENV WEB_CONCURRENCY=3 WORKER_HEAP_MB=384 UV_THREADPOOL_SIZE=2
USER node
EXPOSE 3000
# Coolify menunggu container baru sehat sebelum mematikan yang lama.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# node langsung sebagai PID 1 (bukan npm) supaya SIGTERM dari Docker sampai ke server.mjs.
CMD ["node", "server.mjs"]
