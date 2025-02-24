# Temporary image to build app
FROM node:bookworm-slim AS builder

WORKDIR /usr/src/app

COPY package*.json lerna.json tsconfig-build.json rollup-template.js ./

COPY ./packages/config-parser ./packages/config-parser
COPY ./packages/crypto ./packages/crypto
COPY ./packages/logger ./packages/logger
COPY ./packages/utils ./packages/utils
COPY ./packages/matrix-resolve ./packages/matrix-resolve

COPY ./packages/matrix-identity-server ./packages/matrix-identity-server

COPY ./packages/federated-identity-service ./packages/federated-identity-service
COPY ./packages/federated-identity-service/server.mjs ./server.mjs

RUN npm install && \
    npm run build -- --skip-nx-cache && \
    rm -rf node_modules */*/node_modules && \
    npm install --production && \
    npm cache clean --force

# Final image
FROM node:bookworm-slim AS tom-server

ENV TEMPLATE_DIR=/usr/src/app/packages/federated-identity-service/templates \
    LOG_LEVEL=error \
    LOG_TRANSPORTS=Console

COPY --from=builder /usr/src/app /usr/src/app/

WORKDIR /usr/src/app

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
