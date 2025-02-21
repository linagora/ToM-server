# Temporary image to build app
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json lerna.json tsconfig-build.json rollup-template.js ./

COPY ./packages/config-parser ./packages/config-parser
COPY ./packages/crypto ./packages/crypto
COPY ./packages/logger ./packages/logger

COPY ./packages/matrix-application-server ./packages/matrix-application-server
# COPY ./packages/matrix-application-server/server.mjs ./server.mjs

# Build and clean
RUN npm install && \
    npm run build -- --skip-nx-cache && \
    rm -rf node_modules */*/node_modules && \
    npm install --production && \
    npm cache clean --force

FROM node:18-alpine AS tom-server

# ENV BASE_URL= \
#     NODE_EXTRA_CA_CERTS= \
#     LOG_LEVEL=error \
#     LOG_TRANSPORTS=Console \
#     LOG_FILE=

COPY --from=builder /usr/src/app /usr/src/app/

WORKDIR /usr/src/app

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
