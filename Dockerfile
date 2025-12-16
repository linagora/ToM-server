# Base for final image
FROM node:18.20.8-alpine AS node-minimal

# Temporary image to build app
FROM node:18.20.8-alpine AS builder

WORKDIR /usr/src/app

# COPIES
# 1. Files
COPY package*.json ./
RUN npm install

COPY .njsscan *.js *.json *.mjs LICENSE ./

# 2. Directories
COPY packages ./packages/
COPY landing /usr/src/app/landing

# Build and clean
RUN npm install && \
    npm run build -- --skip-nx-cache && \
    rm -rf node_modules */*/node_modules && \
    npm install --production && \
    npm cache clean --force

FROM node-minimal AS tom-server

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
    LOG_LEVEL=error \
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
    SERVER_NAME= \
    TEMPLATE_DIR=/usr/src/app/packages/tom-server/templates \
    UPDATE_FEDERATED_IDENTITY_HASHES_CRON="3 3 * * *" \
    UPDATE_USERS_CRON="*/15 * * * *" \
    PEPPER_CRON="9 1 * * *" \
    SMS_API_LOGIN= \
    SMS_API_URL= \
    SMS_API_KEY= \
    RATE_LIMITING_WINDOW= \
    RATE_LIMITING_NB_REQUESTS= \
    TRUSTED_PROXIES= \
    QRCODE_URL= \
    CHAT_URL= \
    TCHAT_APPLICATION_NAME= \
    TCHAT_APPLICATION_WELCOME_MESSAGE= \
    MATRIX_SERVER= \
    TCHAT_PRIVACY_URL= \
    TCHAT_RENDER_HTML= \
    TCHAT_HIDE_REDACTED_EVENTS= \
    TCHAT_HIDE_UNKNOWN_EVENTS= \
    TCHAT_ISSUE_ID= \
    TCHAT_REGISTRATION_URL= \
    TCHAT_TWAKE_WORKPLACE_HOMESERVER= \
    TCHAT_APP_GRID_DASHBOARD_AVAILABLE= \
    TCHAT_PLATFORM= \
    TCHAT_MAX_UPLOAD_AVATAR_SIZE= \
    TCHAT_DEV_MODE= \
    TCHAT_QR_CODE_DOWNLOAD_URL= \
    TCHAT_ENABLE_LOGS= \
    TCHAT_SUPPORT_URL= \
    TCHAT_ENABLE_INVITATIONS= \
    FEATURE_USER_PROFILE_DEFAULT_VISIBILITY= \
    FEATURE_USER_PROFILE_DEFAULT_VISIBLE_FIELDS= \
    FEATURE_USER_DIRECTORY_ENABLED=

COPY --from=builder /usr/src/app /usr/src/app/

WORKDIR /usr/src/app

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
