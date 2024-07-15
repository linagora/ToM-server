# Use Tawe-on-Matrix server with docker

Image are published in docker hub:
 * [The ToM Server itself](https://hub.docker.com/r/linagora/tom-server)
 * [The Federated Identity Service](https://hub.docker.com/r/linagora/tom-federated-identity-service)

## The ToM server image

### Synopsis

```shell
$ docker run -d -p 3000:3000 \
    -e ADDITIONAL_FEATURES=true \
    -e BASE_URL=https://tom.example.com/ \
    -e CRON_SERVICE=true \
    -e DATABASE_ENGINE=pg \
    -e DATABASE_USER=twake \
    -e DATABASE_PASSWORD=mydbpassword \
    -e DATABASE_HOST=pg-host.xyz \
    -e DATABASE_NAME=twake \
    -e DATABASE_SSL=true \
    -e LDAP_BASE=dc=example,dc=com \
    -e LDAP_FILTER=(objectClass=inetOrgPerson) \
    -e LDAP_URI=ldap://annuaire \
    -e JITSI_BASE_URL=https://meet.tom-dev.xyz \
    -e JITSI_PREFERRED_DOMAIN=meet.tom-dev.xyz \
    -e MATRIX_SERVER=matrix.example.com \
    -e MATRIX_DATABASE_ENGINE=pg \
    -e MATRIX_DATABASE_HOST=synapse-db \
    -e MATRIX_DATABASE_NAME=synapse \
    -e MATRIX_DATABASE_PASSWORD=synapse!1 \
    -e MATRIX_DATABASE_USER=synapse \
    -e MATRIX_DATABASE_SSL=true \
    -e OIDC_ISSUER=https://auth.example.com/ \
    -e SERVER_NAME=example.com \
    -e RATE_LIMITING_WINDOW=10
    -e RATE_LIMITING_NB_REQUESTS=100
    linagora/tom-server
