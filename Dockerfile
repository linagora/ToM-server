FROM node:latest

env BASE_URL= \
    CRON_SERVICE= \
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
    MATRIX_SERVER= \
    MATRIX_DATABASE_ENGINE= \
    MATRIX_DATABASE_HOST= \
    MATRIX_DATABASE_NAME= \
    MATRIX_DATABASE_PASSWORD= \
    MATRIX_DATABASE_USER= \
    SERVER_NAME=

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .

RUN npm install && npm run build

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
