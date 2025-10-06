# Backend Dockerfile - Multi-stage build
FROM node:20-bookworm AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig*.json tsup.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript bundle
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

# Set environment variables early
ENV NODE_ENV=production
ENV PORT=3002

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application from builder
COPY --from=builder /app/dist ./dist

# Copy SPS data directory (required at runtime)
COPY src/sps/data ./src/sps/data

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application (using compiled dist/index.js)
CMD ["node", "dist/index.js"]
