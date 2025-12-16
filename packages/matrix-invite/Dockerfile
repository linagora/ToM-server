# Base for final image
FROM node:18.20.8-alpine AS node-minimal

# Temporary image to build app
FROM node:18.20.8-alpine AS builder

WORKDIR /usr/src/app

COPY . .
RUN ls -l /usr/src/app

RUN npm i
RUN npm run build
RUN ls -l /usr/src/app

FROM node-minimal

WORKDIR /app
RUN rm -rf ./*
COPY --from=builder /usr/src/app/package.json .
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/node_modules ./node_modules

EXPOSE $PORT 

CMD ["node", "build"]
