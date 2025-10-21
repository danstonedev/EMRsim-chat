# Backend Dockerfile - Multi-stage build
FROM node:20-bookworm AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig*.json tsup.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript bundle
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

# Set environment variables early
ENV NODE_ENV=production
# Use PORT from environment with fallback value
ENV PORT=${PORT:-3002}

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm install --production --no-package-lock && npm cache clean --force

# Copy compiled application from builder
COPY --from=builder /app/dist ./dist

# Copy SPS content (required at runtime for scenario loading)
COPY src/sps/content ./src/sps/content

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose dynamic port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const port = process.env.PORT || 3002; require('http').get(`http://localhost:${port}/health`, (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application (using compiled dist/index.js)
CMD ["node", "dist/index.js"]
