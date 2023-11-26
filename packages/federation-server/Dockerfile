FROM node:18

env BASE_URL= \
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
    SERVER_NAME= \
    TEMPLATE_DIR= \
    TRUSTED_SERVERS_ADDRESSES=

RUN apt update && apt -y dist-upgrade

WORKDIR /usr/src/app

COPY ./packages/federation-server/server.mjs .

COPY ./packages/crypto ./packages/crypto
COPY ./packages/logger ./packages/logger
COPY ./packages/matrix-resolve ./packages/matrix-resolve
COPY ./packages/matrix-identity-server ./packages/matrix-identity-server
COPY ./packages/config-parser ./packages/config-parser
COPY ./packages/federation-server ./packages/federation-server
COPY .husky .husky
COPY lerna.json ./
COPY tsconfig-build.json ./
COPY rollup-template.js ./
COPY package*.json ./

RUN npm install && npm run build

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
