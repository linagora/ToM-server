# Temporary image to build app
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json lerna.json tsconfig-build.json rollup-template.js ./

COPY ./packages/config-parser ./packages/config-parser
COPY ./packages/crypto ./packages/crypto
COPY ./packages/logger ./packages/logger
COPY ./packages/utils ./packages/utils
COPY ./packages/matrix-resolve ./packages/matrix-resolve
# COPY ./packages/matrix-invite ./packages/matrix-invite
# COPY ./packages/retry-promise ./packages/retry-promise

COPY ./packages/matrix-identity-server ./packages/matrix-identity-server

# Build and clean
RUN npm install && \
    npm run build -- --skip-nx-cache && \
    rm -rf node_modules */*/node_modules && \
    npm install --production && \
    npm cache clean --force

FROM node:18-alpine AS tom-server

ENV TEMPLATE_DIR=/usr/src/app/packages/matrix-identity-server/templates \
    LOG_LEVEL=error \
    LOG_TRANSPORTS=Console

COPY --from=builder /usr/src/app /usr/src/app/

WORKDIR /usr/src/app

RUN ln -s packages/matrix-identity-server/server.mjs ./server.mjs

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
