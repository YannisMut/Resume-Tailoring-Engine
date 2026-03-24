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

# Copy source needed for build
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/

# Build types package first, then API
RUN npm run build --workspace=packages/types && \
    npm run build --workspace=apps/api

# === Stage 3: Production runner ===
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package files for production install
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/types/package.json ./packages/types/
COPY --from=build /app/packages/types/dist/ ./packages/types/dist/

# Patch @resume/types to resolve from dist/ instead of src/ (src/ is for local dev with tsx)
RUN node -e " \
  const fs = require('fs'); \
  const p = JSON.parse(fs.readFileSync('packages/types/package.json')); \
  p.main = './dist/index.js'; \
  p.exports = { '.': { require: './dist/index.js', import: './dist/index.mjs', types: './dist/index.d.ts' } }; \
  fs.writeFileSync('packages/types/package.json', JSON.stringify(p)); \
"

# Install production dependencies only (no tsx, tsup, vitest, etc.)
RUN npm ci --omit=dev --workspace=apps/api --workspace=packages/types

# Copy the built dist
COPY --from=build /app/apps/api/dist/ ./apps/api/dist/

EXPOSE 3001
ENV PORT=3001

CMD ["node", "apps/api/dist/index.js"]
