FROM node:18-alpine AS builder

WORKDIR /app

# 1. Copy root package files
COPY package.json package-lock.json ./

# 2. Copy workspace package.json files
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/types/package.json ./packages/types/

# 3. Install dependencies
RUN npm ci

# 4. Copy source code
COPY apps/frontend ./apps/frontend
COPY packages ./packages

# 5. Build Frontend
WORKDIR /app/apps/frontend
# Explicitly set correct env for build if needed, though usually build can be generic
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# --- Runner Stage ---
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create simple non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# We need to rely on standalone build or copy node_modules. 
# For simplicity in this monorepo, we'll copy the built artifacts and node_modules.
# Ideally use "output: standalone" in next.config.js for smaller images.

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next ./apps/frontend/.next

WORKDIR /app/apps/frontend

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
