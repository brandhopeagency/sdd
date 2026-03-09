FROM node:20-alpine AS builder

WORKDIR /app

# Native build toolchain for modules like bcrypt when prebuilt binaries are unavailable
RUN apk add --no-cache python3 make g++

# Copy package files and npm config
COPY package*.json ./
COPY .npmrc ./

# Copy source code (chat-types folder may or may not be present in context)
COPY . .

# Install all dependencies (including dev for build).
# If local chat-types is present, use it. Otherwise fall back to registry package version.
ARG GITHUB_TOKEN
ARG CHAT_TYPES_VERSION=latest
RUN mkdir -p ./chat-types
RUN if [ -f ./chat-types/package.json ]; then \
      npm pkg set "dependencies.@mentalhelpglobal/chat-types=file:./chat-types"; \
    else \
      npm pkg set "dependencies.@mentalhelpglobal/chat-types=${CHAT_TYPES_VERSION}"; \
    fi
RUN npm install

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Keep runtime install resilient for native modules during --omit=dev install
RUN apk add --no-cache python3 make g++

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

# Copy chat-types if present in builder context (empty dir is also fine)
RUN mkdir -p ./chat-types
COPY --from=builder /app/chat-types ./chat-types
COPY --from=builder /app/.npmrc ./
ARG GITHUB_TOKEN
ARG CHAT_TYPES_VERSION=latest
RUN if [ -f ./chat-types/package.json ]; then \
      npm pkg set "dependencies.@mentalhelpglobal/chat-types=file:./chat-types"; \
    else \
      npm pkg set "dependencies.@mentalhelpglobal/chat-types=${CHAT_TYPES_VERSION}"; \
    fi
RUN npm install --omit=dev
RUN rm -f .npmrc

# Cloud Run uses PORT env variable
EXPOSE 8080
ENV PORT=8080

# Run the server
CMD ["node", "dist/index.js"]

