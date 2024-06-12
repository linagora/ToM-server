FROM node:18

ENV BASE_URL= \
    CRON_SERVICE= \
    CROWDSEC_URI= \
    DATABASE_ENGINE= \
    DATABASE_HOST= \
    DATABASE_NAME= \
    DATABASE_USER= \
    DATABASE_PASSWORD= \
    DATABASE_SSL= \
    LDAP_BASE= \
    LDAP_FILTER= \
    LDAP_USER= \
    LDAP_PASSWORD= \
    LDAP_URI= \
    LOG_LEVEL=error \
    LOG_TRANSPORTS=Console \
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

RUN apt update && apt -y dist-upgrade

WORKDIR /usr/src/app

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

RUN npm install && npm run build && npm cache clean --force

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
