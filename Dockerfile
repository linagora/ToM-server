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
# 1. Files
COPY package*.json .njsscan *.js *.json *.mjs LICENSE ./

# 2. Directories
COPY .husky ./.husky/
COPY packages ./packages/
COPY landing /usr/src/app/landing
#COPY node_modules ./node_modules/

# Build and clean

RUN npm install && npm run build && \
    rm -rf node_modules */*/node_modules && \
    npm install --production --ignore-scripts && \
    npm cache clean --force

FROM node-minimal as tom-server

ENV BASE_URL= \
    CRON_SERVICE= \
    CROWDSEC_URI= \
    CROWDSEC_KEY= \
    DATABASE_ENGINE= \
    DATABASE_HOST= \
    DATABASE_NAME= \
    DATABASE_USER= \
    DATABASE_PASSWORD= \
    DATABASE_SSL= \
    FEDERATED_IDENTITY_SERVICES= \
    JITSI_BASE_URL= \
    JITSI_JWT_ALGORITHM= \
    JITSI_JWT_ISSUER= \
    JITSI_SECRET= \
    JITSI_PREFERRED_DOMAIN= \
    JITSI_USE_JWT= \
    LDAP_BASE= \
    LDAP_FILTER= \
    LDAP_USER= \
    LDAP_PASSWORD= \
    LDAP_URI= \
    LOGGER=error \
    LOG_TRANSPORTS=Console \
    MATRIX_SERVER= \
    MATRIX_DATABASE_ENGINE= \
    MATRIX_DATABASE_HOST= \
    MATRIX_DATABASE_NAME= \
    MATRIX_DATABASE_PASSWORD= \
    MATRIX_DATABASE_SSL= \
    MATRIX_DATABASE_USER= \
    NODE_EXTRA_CA_CERTS= \
    OIDC_ISSUER= \
    OPENSEARCH_CA_CERT_PATH= \
    OPENSEARCH_HOST= \
    OPENSEARCH_IS_ACTIVATED= \
    OPENSEARCH_MAX_RETRIES= \
    OPENSEARCH_NUMBER_OF_SHARDS= \
    OPENSEARCH_NUMBER_OF_REPLICAS= \
    OPENSEARCH_PASSWORD= \
    OPENSEARCH_SSL= \
    OPENSEARCH_USER= \
    OPENSEARCH_WAIT_FOR_ACTIVE_SHARDS= \
    SERVER_NAME= \
    TEMPLATE_DIR=/usr/src/app/packages/tom-server/templates \
    UPDATE_FEDERATED_IDENTITY_HASHES_CRON="3 3 * * *" \
    UPDATE_USERS_CRON="*/15 * * * *" \
    SMS_API_LOGIN= \
    SMS_API_URL= \
    SMS_API_KEY= \
    RATE_LIMITING_WINDOW= \
    RATE_LIMITING_NB_REQUESTS= \
    TRUSTED_PROXIES=

COPY --from=1 /usr/src/app /usr/src/app/

WORKDIR /usr/src/app

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
