FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Copy SQL files (not included in TypeScript build)
# Ensure db directory exists
RUN mkdir -p ./dist/db

# Copy schema.sql
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql

# Copy migrations directory
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

# Verify SQL files are copied (for debugging in case of issues)
RUN test -f ./dist/db/schema.sql && echo "✓ schema.sql copied" || echo "✗ schema.sql NOT found"
RUN test -d ./dist/db/migrations && echo "✓ migrations directory copied" || echo "✗ migrations directory NOT found"

# Install production dependencies only
RUN npm ci --omit=dev

# Cloud Run uses PORT env variable
EXPOSE 8080
ENV PORT=8080

# Run the server
CMD ["node", "dist/index.js"]

