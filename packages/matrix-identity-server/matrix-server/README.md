# Matrix-Synapse server for tests

This repository launches a local Matrix server named "matrix.example.com".

## Setup

First, you need to include DNS names. To do this, just add this line into your
`/etc/hosts` file:

```
127.0.0.1  auth.example.com matrix.example.com tom.example.com
```

To initialize the server, simple launch `./init`

## Run server

Launch `./run`. To see logs:
 * SSO logs: `docker compose logs auth`
 * Synapse logs are in `synapse-data/homeserver.log`

Server runs on https://matrix.example.com/ (API only).

### Available accounts

This repo uses the "Demo" interface of [LemonLDAP::NG](https://lemonldap-ng.org/)
which provides 3 demon accounts: **dwho**, **rsmith** and **rtyler**.
Password is the login.

## Test the server

You can use any Matrix client, but to just test is server is up:
 * Download **llng** tool from [Simple OIDC client repo](https://github.com/linagora/simple-oidc-client)
 * Launch the following command
```shell
llng --llng-server auth.example.com --matrix-server matrix.example.com:443 --login dwho --password dwho matrix_token
```

It will authenticate using the dwho account, then authenticate to Matrix, then get a matrix `access_token`

To get a federation `access_token`, reuse the result of previous command with `matrix_federation_token` subcommand:

```shell
llng --llng-server auth.example.com --matrix-server matrix.example.com:443 --login dwho --password dwho matrix_federation_token syt_ZHdobw_JswjzYCRQiPxhPJPAfbj_15jQrD
```

## Stop server

Launch `./stop` or `docker-compose down`
