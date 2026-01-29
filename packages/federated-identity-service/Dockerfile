# =============================================================================
# federated-identity-service Dockerfile
# Optimized multi-stage build
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies and build
# -----------------------------------------------------------------------------
FROM node:18.20.8-alpine AS builder

# Update image and install build tools
RUN apk update && apk upgrade && \
    apk add --no-cache build-base python3 && \
    rm -rf /var/cache/apk/*

WORKDIR /usr/src/app

# Copy root package files for workspace setup
COPY package.json package-lock.json lerna.json ./

# Copy only required workspace package.json files first (for better caching)
COPY packages/config-parser/package.json ./packages/config-parser/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/logger/package.json ./packages/logger/
COPY packages/utils/package.json ./packages/utils/
COPY packages/matrix-resolve/package.json ./packages/matrix-resolve/
COPY packages/matrix-identity-server/package.json ./packages/matrix-identity-server/
COPY packages/federated-identity-service/package.json ./packages/federated-identity-service/

# Install all dependencies (cached unless package.json changes)
RUN npm ci --ignore-scripts

# Copy build configuration
COPY tsconfig-build.json rollup-template.js ./

# Copy source files for required packages only
COPY packages/config-parser/src ./packages/config-parser/src
COPY packages/config-parser/tsconfig.json packages/config-parser/rollup.config.js ./packages/config-parser/

COPY packages/crypto/src ./packages/crypto/src
COPY packages/crypto/tsconfig.json packages/crypto/rollup.config.js ./packages/crypto/

COPY packages/logger/src ./packages/logger/src
COPY packages/logger/tsconfig.json packages/logger/rollup.config.js ./packages/logger/

COPY packages/utils/src ./packages/utils/src
COPY packages/utils/tsconfig.json packages/utils/rollup.config.js ./packages/utils/

COPY packages/matrix-resolve/src ./packages/matrix-resolve/src
COPY packages/matrix-resolve/tsconfig.json packages/matrix-resolve/rollup.config.js ./packages/matrix-resolve/

COPY packages/matrix-identity-server/src ./packages/matrix-identity-server/src
COPY packages/matrix-identity-server/tsconfig.json packages/matrix-identity-server/rollup.config.js ./packages/matrix-identity-server/
COPY packages/matrix-identity-server/templates ./packages/matrix-identity-server/templates

COPY packages/federated-identity-service/src ./packages/federated-identity-service/src
COPY packages/federated-identity-service/tsconfig.json packages/federated-identity-service/rollup.config.js ./packages/federated-identity-service/
COPY packages/federated-identity-service/server.mjs ./packages/federated-identity-service/

# Rebuild native modules and build all packages in dependency order
RUN npm rebuild && \
    npm run build --workspace=@twake/config-parser && \
    npm run build --workspace=@twake/crypto && \
    npm run build --workspace=@twake/logger && \
    npm run build --workspace=@twake/utils && \
    npm run build --workspace=matrix-resolve && \
    npm run build --workspace=@twake/matrix-identity-server && \
    npm run build --workspace=@twake/federated-identity-service

# -----------------------------------------------------------------------------
# Stage 2: Production dependencies
# -----------------------------------------------------------------------------
FROM node:18.20.8-alpine AS deps

WORKDIR /usr/src/app

# Copy package files
COPY package*.json lerna.json ./
COPY packages/config-parser/package.json ./packages/config-parser/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/logger/package.json ./packages/logger/
COPY packages/utils/package.json ./packages/utils/
COPY packages/matrix-resolve/package.json ./packages/matrix-resolve/
COPY packages/matrix-identity-server/package.json ./packages/matrix-identity-server/
COPY packages/federated-identity-service/package.json ./packages/federated-identity-service/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts && npm rebuild

# -----------------------------------------------------------------------------
# Stage 3: Final runtime image
# -----------------------------------------------------------------------------
FROM node:18.20.8-alpine AS runtime

WORKDIR /usr/src/app

# Copy production node_modules
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --parents --from=deps /usr/src/app/packages/*/node_modules ./

# Copy built artifacts
COPY --from=builder /usr/src/app/packages/config-parser/dist ./packages/config-parser/dist
COPY --from=builder /usr/src/app/packages/config-parser/package.json ./packages/config-parser/

COPY --from=builder /usr/src/app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /usr/src/app/packages/crypto/package.json ./packages/crypto/

COPY --from=builder /usr/src/app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /usr/src/app/packages/logger/package.json ./packages/logger/

COPY --from=builder /usr/src/app/packages/utils/dist ./packages/utils/dist
COPY --from=builder /usr/src/app/packages/utils/package.json ./packages/utils/

COPY --from=builder /usr/src/app/packages/matrix-resolve/dist ./packages/matrix-resolve/dist
COPY --from=builder /usr/src/app/packages/matrix-resolve/package.json ./packages/matrix-resolve/

COPY --from=builder /usr/src/app/packages/matrix-identity-server/dist ./packages/matrix-identity-server/dist
COPY --from=builder /usr/src/app/packages/matrix-identity-server/package.json ./packages/matrix-identity-server/
COPY --from=builder /usr/src/app/packages/matrix-identity-server/templates ./packages/matrix-identity-server/templates

COPY --from=builder /usr/src/app/packages/federated-identity-service/dist ./packages/federated-identity-service/dist
COPY --from=builder /usr/src/app/packages/federated-identity-service/package.json ./packages/federated-identity-service/

# Copy root package.json for workspace resolution
COPY --from=builder /usr/src/app/packages/federated-identity-service/server.mjs ./
COPY package.json ./

USER node

EXPOSE 3000
CMD ["node", "server.mjs"]
