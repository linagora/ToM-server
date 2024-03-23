FROM node:18

env BASE_URL= \
    CRON_SERVICE= \
    CROWDSEC_URI= \
    CROWDSEC_KEY= \
    DATABASE_ENGINE= \
    DATABASE_HOST= \
    DATABASE_NAME= \
    DATABASE_USER= \
    DATABASE_PASSWORD= \
    DATABASE_SSL= \
    FEDERATION_SERVERS= \
    LDAP_BASE= \
    LDAP_FILTER= \
    LDAP_USER= \
    LDAP_PASSWORD= \
    LDAP_URI= \
    JITSI_BASE_URL= \
    JITSI_JWT_ALGORITHM= \
    JITSI_JWT_ISSUER= \
    JITSI_SECRET= \
    JITSI_PREFERRED_DOMAIN= \
    JITSI_USE_JWT= \
    MATRIX_SERVER= \
    MATRIX_DATABASE_ENGINE= \
    MATRIX_DATABASE_HOST= \
    MATRIX_DATABASE_NAME= \
    MATRIX_DATABASE_PASSWORD= \
    MATRIX_DATABASE_SSL= \
    MATRIX_DATABASE_USER= \
    OIDC_ISSUER= \
    SERVER_NAME= \
    TEMPLATE_DIR=/usr/src/app/packages/tom-server/templates \
    UDPATE_FEDERATION_HASHES_CRON="3 3 * * *" \
    UPDATE_USERS_CRON="*/15 * * * *" \
    SMS_API_LOGIN= \
    SMS_API_URL= \
    SMS_API_KEY=

RUN apt update && apt -y dist-upgrade

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .

RUN npm install && npm run build && npm cache clean --force

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
