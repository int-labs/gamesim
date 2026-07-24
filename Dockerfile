# =============================================================================
# DOCKERFILE FOR SINGLE SERVICE (Player frontend + Backend)
# File: Dockerfile
# Admin is built/deployed separately (see Dockerfile.admin).
# =============================================================================
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache curl

WORKDIR /app

# =============================================================================
# BUILD SHARED PACKAGES
# =============================================================================
COPY shared/finlit-engine/package*.json ./shared/finlit-engine/
COPY shared/api-contract/package*.json ./shared/api-contract/
RUN cd shared/finlit-engine && npm install && \
    cd ../api-contract && npm install

COPY shared/ ./shared/
RUN cd shared/finlit-engine && npm run build && \
    cd ../api-contract && npm run build

# =============================================================================
# BUILD PLAYER (primary frontend served by the server)
# =============================================================================
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
# Shared sources are also resolved via Vite aliases during player build
RUN cd client && npm run build

# =============================================================================
# BUILD BACKEND
# =============================================================================
COPY server/package*.json ./server/
RUN cd server && npm ci

COPY server/ ./server/
RUN cd server && npm run build

# Move player build to server public folder (Vite outDir = dist)
RUN mkdir -p server/public && \
    cp -r client/dist/* server/public/ && \
    chmod -R 755 server/public

# =============================================================================
# SETUP APPLICATION
# =============================================================================
WORKDIR /app/server

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check (use dynamic PORT; default to 3000 for local builds)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD sh -c 'curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1'

# Start application
CMD ["npm", "start"]
