# ── DocRAFT Frontend ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install deps first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application code
COPY . .

EXPOSE 3000

# Dev server with hot-reload
CMD ["npm", "run", "dev"]
