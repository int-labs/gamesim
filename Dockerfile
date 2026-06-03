# =============================================================================
# DOCKERFILE FOR SINGLE SERVICE (Frontend + Backend)
# File: Dockerfile
# =============================================================================
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache curl

WORKDIR /app

# =============================================================================
# BUILD FRONTEND
# =============================================================================
# Copy and install client dependencies
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy client source and build
COPY client/ ./client/
RUN cd client && npm run build

# =============================================================================
# BUILD BACKEND  
# =============================================================================
# Copy and install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci

# Copy server source code
COPY server/ ./server/

# Build TypeScript server
RUN cd server && npm run build

# Move frontend build to server public folder
RUN mkdir -p server/public && \
    cp -r client/build/* server/public/ && \
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