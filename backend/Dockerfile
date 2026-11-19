FROM node:20-bookworm-slim
# FFmpeg is required by the video worker (and ffprobe by the upload validation)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
ENV NODE_ENV=production PORT=5000 LOCAL_STORAGE_DIR=/data/storage TMP_DIR=/data/tmp
RUN mkdir -p /data/storage /data/tmp && chown -R node:node /data /app
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
