FROM node:18

RUN apt update && apt -y dist-upgrade

WORKDIR /usr/src/app

COPY ./packages/federated-identity-service/src/__testData__/identity-server/server.mjs .

COPY ./packages/matrix-identity-server ./packages/matrix-identity-server
COPY ./packages/logger ./packages/logger
COPY ./packages/crypto ./packages/crypto
COPY ./packages/config-parser ./packages/config-parser
COPY ./packages/matrix-resolve ./packages/matrix-resolve
COPY ./packages/utils ./packages/utils
COPY ./lerna.json ./
COPY ./tsconfig-build.json ./
COPY ./rollup-template.js ./
COPY ./package*.json ./

RUN npm install && npm run build

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
