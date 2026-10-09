# DPro Absen: build Next.js untuk Coolify di VPS (Vercel mengabaikan berkas ini).
FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
ARG NEXT_PUBLIC_VAPID_PUBLIC
ENV NEXT_PUBLIC_VAPID_PUBLIC=$NEXT_PUBLIC_VAPID_PUBLIC
RUN npm ci && npm run build && chown -R node:node .next
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
USER node
EXPOSE 3000
# Coolify menunggu container baru sehat sebelum mematikan yang lama.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
