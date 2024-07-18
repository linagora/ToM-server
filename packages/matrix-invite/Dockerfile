# Base for final image
FROM debian:bookworm-slim as node-minimal

ENV PORT=5000

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

COPY . .
RUN ls -l /usr/src/app

RUN npm i
RUN npm run build
RUN ls -l /usr/src/app

from node-minimal

WORKDIR /app
RUN rm -rf ./*
COPY --from=builder /usr/src/app/package.json .
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/node_modules ./node_modules

EXPOSE $PORT 

CMD ["node", "build"]
