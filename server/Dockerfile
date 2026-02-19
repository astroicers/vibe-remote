FROM node:22-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI (required by Agent SDK)
RUN npm install -g @anthropic-ai/claude-code

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Create data directory and workspace mount point
# Use built-in 'node' user (uid 1000) to match host 'ubuntu' user (uid 1000)
RUN mkdir -p data /workspace && \
    chown -R node:node /app /workspace

# Expose port (overridable via PORT env var)
EXPOSE 8080

# Run as non-root user (required: Claude CLI refuses --dangerously-skip-permissions as root)
USER node

# Start server
CMD ["npx", "tsx", "src/index.ts"]
