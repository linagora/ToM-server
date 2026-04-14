FROM alpine:3.21

ARG MKCERT_VERSION="v1.4.4"
ARG TARGETARCH
ARG DOMAINS="docker.internal *.docker.internal localhost"

RUN apk add --no-cache openssl curl && \
    curl -Lo /usr/local/bin/mkcert \
      "https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/mkcert-${MKCERT_VERSION}-linux-$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "amd64")" && \
    chmod +x /usr/local/bin/mkcert && \
    apk del curl

WORKDIR /certs

ENV CAROOT=/certs
ENV DOMAINS=${DOMAINS}

COPY entrypoint.sh /entrypoint.sh

RUN sed -i 's/\r//' /entrypoint.sh && \
    chmod +x /entrypoint.sh

CMD ["/bin/sh", "/entrypoint.sh"]
