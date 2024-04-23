# Base for final image
FROM debian:bookworm-slim as node-minimal

RUN apt update && \
    apt -y dist-upgrade && \
    apt -y install nodejs && \
    apt autoremove -y && \
    apt clean && \
    rm -rf /var/lib/apt/lists/*

# Temporary image to build app
FROM debian:bookworm-slim as builder

RUN apt update && \
    apt -y dist-upgrade && \
    apt -y install nodejs npm && \
    apt autoremove -y && \
    apt clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# COPIES
COPY ./packages/federated-identity-service/server.mjs .
COPY ./packages/crypto ./packages/crypto
COPY ./packages/logger ./packages/logger
COPY ./packages/matrix-resolve ./packages/matrix-resolve
COPY ./packages/matrix-identity-server ./packages/matrix-identity-server
COPY ./packages/config-parser ./packages/config-parser
COPY ./packages/federated-identity-service ./packages/federated-identity-service
COPY .husky .husky
COPY lerna.json ./
COPY tsconfig-build.json ./
COPY rollup-template.js ./
COPY package*.json ./

RUN npm install && npm run build && \
    rm -rf node_modules */*/node_modules && \
    npm install --production --ignore-scripts && \
    npm cache clean --force

FROM node-minimal as federation-server

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

COPY --from=1 /usr/src/app /usr/src/app/

WORKDIR /usr/src/app

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]