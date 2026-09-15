# =============================================================================
# ToM Server - production image
#
# Usage:
#   docker build -t tom-server .
#   docker run
#       -v /path/to/config.yaml:/data/config.yaml:ro
#       --rm tom-server
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 - builder: compile into a standalone binary with bunup
# -----------------------------------------------------------------------------
FROM docker.io/oven/bun:debian AS builder

WORKDIR /app

COPY package.json bun.lock bunup.config.ts tsconfig.json ./
COPY src/ ./src/

RUN bun install --frozen-lockfile

RUN bunx bunup

# -----------------------------------------------------------------------------
# Stage 2 - runtime image: fresh with assets files and binary only
# -----------------------------------------------------------------------------
FROM docker.io/debian:stable-slim AS runtime

WORKDIR /usr/share/twake/chat/tom

COPY ./assets/i18n/ ./i18n/
COPY ./assets/static/ ./static/
COPY ./assets/templates/ ./templates/

WORKDIR /app
RUN mkdir -p /data

COPY --from=builder /app/bin/tom-bridge ./

ENTRYPOINT ["./tom-server", "--config", "/data/config.yaml"]
