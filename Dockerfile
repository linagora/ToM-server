FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .

RUN npm install && npm run build

EXPOSE 3000
CMD [ "node", "/usr/src/app/server.mjs" ]
