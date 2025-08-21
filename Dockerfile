FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./
COPY .env.example ./

# Build TypeScript
RUN npm run build

# Don't remove any dependencies - keep everything for runtime
# RUN npm prune --production && npm cache clean --force

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Start the application
CMD ["node", "dist/server.js"]
