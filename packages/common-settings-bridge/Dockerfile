# =============================================================================
# common-settings-bridge Dockerfile
# Optimized multi-stage build
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies and build
# -----------------------------------------------------------------------------
FROM node:18.20.8-slim AS builder
#                 ^ matrix crypto sdk requires a glibc
#                   symbol not available in alpine...

# Update image and install build tools
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get upgrade -yqq && \
    apt-get install -yqq build-essential python3 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy root package files for workspace setup
COPY package.json package-lock.json lerna.json ./

# Copy only required workspace package.json files first (for better caching)
COPY packages/config-parser/package.json ./packages/config-parser/
COPY packages/logger/package.json ./packages/logger/
COPY packages/amqp-connector/package.json ./packages/amqp-connector/
COPY packages/db/package.json ./packages/db/
COPY packages/common-settings-bridge/package.json ./packages/common-settings-bridge/

# Install all dependencies (cached unless package.json changes)
RUN npm ci --ignore-scripts

# Copy build configuration
COPY tsconfig-build.json rollup-template.js ./

# Copy source files for required packages only
COPY packages/config-parser/src ./packages/config-parser/src
COPY packages/config-parser/tsconfig.json packages/config-parser/rollup.config.js ./packages/config-parser/

COPY packages/logger/src ./packages/logger/src
COPY packages/logger/tsconfig.json packages/logger/rollup.config.js ./packages/logger/

COPY packages/amqp-connector/src ./packages/amqp-connector/src
COPY packages/amqp-connector/tsconfig.json packages/amqp-connector/rollup.config.js ./packages/amqp-connector/

COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json packages/db/rollup.config.js ./packages/db/

COPY packages/common-settings-bridge/src ./packages/common-settings-bridge/src
COPY packages/common-settings-bridge/tsconfig.json packages/common-settings-bridge/rollup.config.js packages/common-settings-bridge/config.yaml.example ./packages/common-settings-bridge/

# Rebuild native modules and build all packages (use build:lib for packages with examples)
RUN npm rebuild && \
    npm run build --workspace=@twake/config-parser && \
    npm run build:lib --workspace=@twake/logger && \
    npm run build --workspace=@twake/amqp-connector && \
    npm run build --workspace=@twake/db && \
    npm run build --workspace=@twake/common-settings-bridge

# -----------------------------------------------------------------------------
# Stage 2: Production dependencies
# -----------------------------------------------------------------------------
FROM node:18.20.8-slim AS deps

WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json lerna.json ./
COPY packages/config-parser/package.json ./packages/config-parser/
COPY packages/logger/package.json ./packages/logger/
COPY packages/amqp-connector/package.json ./packages/amqp-connector/
COPY packages/db/package.json ./packages/db/
COPY packages/common-settings-bridge/package.json ./packages/common-settings-bridge/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts && npm rebuild

# -----------------------------------------------------------------------------
# Stage 3: Final runtime image
# -----------------------------------------------------------------------------
FROM node:18.20.8-slim AS runtime

# Update image and install runtime dependencies
# ENV DEBIAN_FRONTEND=noninteractive
# RUN apt-get update && apt-get upgrade -yqq && \
#     apt-get install -yqq python3 && \
#     apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy production node_modules
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/packages/*/node_modules ./packages/

# Copy built artifacts
COPY --from=builder /usr/src/app/packages/config-parser/dist ./packages/config-parser/dist
COPY --from=builder /usr/src/app/packages/config-parser/package.json ./packages/config-parser/

COPY --from=builder /usr/src/app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /usr/src/app/packages/logger/package.json ./packages/logger/

COPY --from=builder /usr/src/app/packages/amqp-connector/dist ./packages/amqp-connector/dist
COPY --from=builder /usr/src/app/packages/amqp-connector/package.json ./packages/amqp-connector/

COPY --from=builder /usr/src/app/packages/db/dist ./packages/db/dist
COPY --from=builder /usr/src/app/packages/db/package.json ./packages/db/

COPY --from=builder /usr/src/app/packages/common-settings-bridge/dist ./packages/common-settings-bridge/dist
COPY --from=builder /usr/src/app/packages/common-settings-bridge/package.json ./packages/common-settings-bridge/
COPY --from=builder /usr/src/app/packages/common-settings-bridge/config.yaml.example ./packages/common-settings-bridge/config.yaml

# Copy root package.json for workspace resolution
COPY package.json ./

# Create data directory for SQLite
RUN mkdir -p /data && chown -R node:node /data

USER node

WORKDIR /usr/src/app/packages/common-settings-bridge

CMD ["node", "dist/index.js", "-c", "config.yaml"]
