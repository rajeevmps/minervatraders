FROM node:18-alpine

WORKDIR /app

# 1. Copy root package files
COPY package.json package-lock.json ./

# 2. Copy workspace package.json files
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/types/package.json ./packages/types/

# 3. Install dependencies (from root to link workspaces)
RUN npm ci

# 4. Copy backend source code
COPY apps/backend ./apps/backend

# 5. Set working directory to backend
WORKDIR /app/apps/backend

# 6. Expose port
EXPOSE 5000

# 7. Start the server
CMD ["npm", "run", "start"]
