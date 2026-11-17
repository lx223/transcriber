# URL-to-transcript CLI with yt-dlp, ffmpeg and Node bundled.
#   docker build -t transcriber .
#   docker run --rm -v transcriber-models:/cache transcriber <url> [options]
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY tsconfig.json ./
COPY cli cli
COPY src src

# Whisper model files download on first fallback; mount a volume here to keep them.
ENV TRANSCRIBER_CACHE=/cache
VOLUME /cache

ENTRYPOINT ["/app/node_modules/.bin/tsx", "/app/cli/main.ts"]
