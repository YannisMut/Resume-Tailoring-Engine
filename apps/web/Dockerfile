# === Stage 1: Install dependencies ===
FROM node:22-alpine AS base
WORKDIR /app

# Copy workspace root files needed for npm install and TypeScript build
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# Copy all workspace package.json files (npm workspaces needs them all)
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

# Install ALL dependencies (including devDependencies — needed for build)
RUN npm ci

# === Stage 2: Build ===
FROM base AS build
WORKDIR /app

# Copy source code
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/

# Build types package first, then Next.js
RUN npm run build --workspace=packages/types && \
    npm run build --workspace=apps/web

# === Stage 3: Production runner ===
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output (includes server.js and traced node_modules)
COPY --from=build /app/apps/web/.next/standalone ./

# Copy static assets (not included in standalone)
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

ENV HOSTNAME=0.0.0.0

# Standalone server entry mirrors the monorepo structure
# Railway sets PORT automatically — don't hardcode it
CMD ["node", "apps/web/server.js"]
