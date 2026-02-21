# ── Stage 1: Build client ──
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ── Stage 2: Build server ──
FROM node:22-slim AS server-build
WORKDIR /app
# Install build deps for better-sqlite3 native module
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*
# Install Claude Code CLI (required by Agent SDK)
RUN npm install -g @anthropic-ai/claude-code
COPY server/package*.json ./
RUN npm ci
COPY server/ .

# ── Stage 3: Runtime ──
FROM node:22-slim
WORKDIR /app

# Install runtime deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ git curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code

COPY --from=server-build /app ./
COPY --from=client-build /app/client/dist /client/dist

# Create data dir and workspace mount
RUN mkdir -p data /workspace && chown -R node:node /app /workspace

EXPOSE 8080
USER node

# Set production defaults
ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]
