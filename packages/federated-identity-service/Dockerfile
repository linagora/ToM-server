# Base for final image
FROM node:18.20.8-alpine AS node-minimal

# Temporary image to build app
FROM node:18.20.8-alpine AS builder

WORKDIR /usr/src/app

# COPIES
COPY package*.json ./
RUN npm install

COPY lerna.json tsconfig-build.json rollup-template.js ./packages/federated-identity-service/server.mjs ./

COPY ./packages/crypto ./packages/crypto
COPY ./packages/logger ./packages/logger
COPY ./packages/matrix-resolve ./packages/matrix-resolve
COPY ./packages/matrix-identity-server ./packages/matrix-identity-server
COPY ./packages/config-parser ./packages/config-parser
COPY ./packages/federated-identity-service ./packages/federated-identity-service
COPY ./packages/utils ./packages/utils

RUN npm install && npm run build && \
    rm -rf node_modules */*/node_modules && \
    npm install --production && \
    npm cache clean --force

FROM node-minimal AS federation-server

ENV BASE_URL= \
    CRON_SERVICE= \
    CROWDSEC_URI= \
    DATABASE_ENGINE= \
    DATABASE_HOST= \
    DATABASE_NAME= \
    DATABASE_USER= \
    DATABASE_PASSWORD= \
    LDAP_BASE= \
    LDAP_FILTER= \
    LDAP_USER= \
    LDAP_PASSWORD= \
    LDAP_URI= \
    MATRIX_DATABASE_ENGINE= \
    MATRIX_DATABASE_HOST= \
    MATRIX_DATABASE_NAME= \
    MATRIX_DATABASE_PASSWORD= \
    MATRIX_DATABASE_USER= \
    NODE_EXTRA_CA_CERTS= \
    SERVER_NAME= \
    TEMPLATE_DIR= \
    TRUST_X_FORWARDED_FOR= \
    TRUSTED_SERVERS_ADDRESSES=

COPY --from=builder /usr/src/app /usr/src/app/

WORKDIR /usr/src/app

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]