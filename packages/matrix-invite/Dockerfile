from node:18-alpine as builder

ENV PORT=5000

WORKDIR /app
COPY . .
RUN npm i
RUN npm run build

from node:18-alpine as deploy

WORKDIR /app
RUN rm -rf ./*
COPY --from=builder /app/package.json .
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

EXPOSE $PORT 

CMD ["node", "build"]
