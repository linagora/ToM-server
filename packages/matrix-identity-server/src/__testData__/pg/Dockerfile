FROM postgres:16-bookworm

LABEL maintainer="Yadd yadd@debian.org>" \
    name="yadd/twke-test-server" \
    version="v1.0"

ENV PG_DATABASE=test \
    PG_USER=twake \
    PG_PASSWORD=twake \
    PG_TABLE=test

COPY install /
