# Serve Tawe-on-Matrix as a container

Image are published in docker hub:

- [The ToM Server itself](https://hub.docker.com/r/linagora/tom-server)
- [The Federated Identity Service](https://hub.docker.com/r/linagora/tom-federated-identity-service)

## ToM Variables

| Status       | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| **required** | Server cannot starts without                                 |
| recommended  | Server can start without, but we advise to use it            |
| *optional*   | Use it to turn on specific features, depending to your needs |

---

Set of variables used to configure ToM features and behavior.

| Name                                    | Description                                                                           | Default                                | Status       |
| --------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- | ------------ |
| `BASE_URL`                              | Public URL. `https://tom.example.com`                                                 | `none`                                 | **required** |
| `DATABASE_ENGINE`                       | The Database engine to use *(`pg` for PostgreSQL or `sqlite`)*                        | `none`                                 | **required** |
| `DATABASE_HOST`                         | `pg`: URL to connect to, `sqlite`: path to the .db file                               | `none`                                 | **required** |
| `DATABASE_NAME`                         | Name of the databse to use *(for `pg` only)*                                          | `none`                                 | **required** |
| `DATABASE_USER`                         | User that will connect to the database *(for `pg` only)*                              | `none`                                 | **required** |
| `DATABASE_PASSWORD`                     | User's password *(for `pg` only)*                                                     | `none`                                 | **required** |
| `DATABASE_SSL`                          | Wether or not to use SSL for db connection *(for `pg` only)*                          | `false`                                | **required** |
| `OIDC_ISSUER`                           | URL of SSO server                                                                     | `none`                                 | **required** |
| `LDAP_BASE`                             | Example: `dc=example,dc=com`                                                          | `none`                                 | recommended  |
| `LDAP_FILTER`                           | Example: `(objectClass=person)`                                                       | `none`                                 | recommended  |
| `LDAP_USER`                             | full LDAP `dn` used to connect                                                        | `none`                                 | recommended  |
| `LDAP_PASSWORD`                         | Password corresponding to the `dn`                                                    | `none`                                 | recommended  |
| `LDAP_URI`                              | URL of the LDAP directory, e.g. `ldaps://ldap.company.com`                            | `none`                                 | recommended  |
| `TEMPLATE_DIR`                          | Path to folder containing mail templates                                              | `node_modules/@twake/server/templates` | recommended  |
| `RATE_LIMITING_WINDOW`                  | How long to remember requests for, in milliseconds.                                   | `600000`                               | recommended  |
| `RATE_LIMITING_NB_REQUESTS`             | How many requests to allow.                                                           | `100`                                  | recommended  |
| `ADDITIONAL_FEATURES`                   | Set true to have all search features                                                  | `false`                                | recommended  |
| `FEDERATED_IDENTITY_SERVICES`           | List of federated identity services                                                   | `[]`                                   | recommended  |
| `CRON_SERVICE`                          | Enable cron tasks                                                                     | `false`                                | *optional*   |
| `PEPPER_CRON`                           | When should the pepper (i.e hash salt) be updated *(cron syntax)*                     | `9 1 * * *`                            | *optional*   |
| `UPDATE_USERS_CRON`                     | When should the users data be refreshed *(cron syntax)*                               | `*/10 * * * *`                         | *optional*   |
| `UPDATE_FEDERATED_IDENTITY_HASHES_CRON` | When should the users hashed data should be sent to federation server *(cron syntax)* | `*/10 * * * *`                            | *optional*   |
| `USERDB_ENGINE`                         | The database engine used to store user data. *(`ldap` or `sqlite`)*                   | `ldap`                                 | *optional*   |
| `LOG_TRANSPORTS`                        |                                                                                       | `Console`                              | *optional*   |
| `LOG_LEVEL`                             | Possible values: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`         | `Console`                              | *optional*   |
| `TRUSTED_PROXIES`                       | IP list of server allowed to set `X-Frowarded-For` header                             | `[]`                                   | *optional*   |

### Matrix

Configure the interconnection of ToM and a Matrix server.

| Name                       | Description                                                                                 | Default  | Status       |
| -------------------------- | ------------------------------------------------------------------------------------------- | -------- | ------------ |
| `SERVER_NAME`              | same value than in Matrix's homeserver.yaml                                                 | `none`   | **required** |
| `MATRIX_SERVER`            | Example: `matrix.company.com`                                                               | `none`   | **required** |
| `MATRIX_DATABASE_ENGINE`   | The Database engine used by the Matrix server *(`pg` for PostgreSQL or `sqlite`)*           | `none`   | *optional*   |
| `MATRIX_DATABASE_HOST`     | `pg`: URL to connect to the Matrix PGSQL instance, `sqlite`: path to the homeserver.db file | `none`   | *optional*   |
| `MATRIX_DATABASE_NAME`     | Name of the databse to use *(for `pg` only)*                                                | `none`   | *optional*   |
| `MATRIX_DATABASE_USER`     | User that will connect to the database *(for `pg` only)*                                    | `none`   | *optional*   |
| `MATRIX_DATABASE_PASSWORD` | User's password *(for `pg` only)*                                                           | `none`   | *optional*   |
| `MATRIX_DATABASE_SSL`      | Wether or not to use SSL for db connection *(for `pg` only)*                                | `false`  | *optional*   |

### Jitsi

Tells ToM to also add Jitsi metadata to the `.well-known`.

| Name                     | Description | Default  | Status     |
| ------------------------ | ----------- | -------- | ---------- |
| `JITSI_BASE_URL`         |             | `none`   | *optional* |
| `JITSI_JWT_ALGORITHM`    |             | `none`   | *optional* |
| `JITSI_JWT_ISSUER`       |             | `none`   | *optional* |
| `JITSI_SECRET`           |             | `none`   | *optional* |
| `JITSI_PREFERRED_DOMAIN` |             | `none`   | *optional* |
| `JITSI_USE_JWT`          |             | `false`  | *optional* |

### Crowdsec

To secure your installation with [the help of the crowd](https://github.com/crowdsecurity/crowdsec).

| Name           | Description                       | Default | Status     |
| -------------- | --------------------------------- | ------- | ---------- |
| `CROWDSEC_URI` | API URI to use                    | `none`  | *optional* |
| `CROWDSEC_KEY` | The secret key for authentication | `none`  | *optional* |

## Use the ToM Image

The ToM server is made to be configured with environment variables, allowing a
fast, easy and flexible configuration - especially for container deployments.

To make the server fits your needs, simply add/remove the corresponding
variables. Though, please note that some remain required. One can use [the
table above](#tom-variables) detailling all available vars.

In the following example, ToM is deployed with its additional features, on the
'example.com' domain, using a PostgreSQL instance for it's own database
storage, another is used for storing Synpase data, and an LDAP directory is
used to store user information (such as nickname, auth credentials, or email):

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
```

## Docker Compose

To facilitate your debuts we provide several compose files, featuring complete environments to run and try ToM:
- [`docker-compose.yml`](./docker-compose.yml): for a basic lightweight deployment (the bare minimum)
- `.compose/examples/`:
  - [`tom+fed+chat.pgsql+ldap.yml`](./.compose/examples/tom+fed+chat.pgsql+ldap.yml): full-featured deployment
  - [`tom+fed+chat.sqlite.yml`](./.compose/examples/tom+fed+chat.sqlite.yml): the lightweight env

These environments are using `docker.localhost` as default domain, and store the
rootCA in [`./.compose/ssl/`](./.compose/ssl/). Feel free to use another domain,
but remember to update the configurations (in the `.compose` folder)
accordingly.

### `/etc/hosts`

```conf
127.0.0.1 docker.localhost        # base domain
127.0.0.1 auth.docker.localhost   # SSO
127.0.0.1 matrix.docker.localhost # matrix server
127.0.0.1 tom.docker.localhost    # tom server
127.0.0.1 fed.docker.localhost    # local federation server
127.0.0.1 chat.docker.localhost   # matrix client (Twake Chat)
```

### Kickstart

To run the compose files, make sure to create the `.compose/.env` file with the `TZ`, `UID` and `GID` fields ; with `UID` and `GID` matching the user's that is running the compose.
Also, when running the lightweight environment make sure to initialize the lemon sqlite database to be able to connect to the service.

```bash
## Uncomment the following to create your own certificate
# pushd .compose/ssl/
# mkcert -install
# mkcert docker.localhost *.docker.localhost
# cat docker.localhost+1.pem docker.localhost+1-key.pem > both.pem
# cp ~/.local/share/mkcert/*.pem .
# openssl rehash .
# popd

## Add your Timezone, UID and GID to the synapse container
pushd .compose/
echo "TZ=$(timedatectl show | grep -Poh '(?<=^Timezone=).*')" | tee .env
echo "UID=$(id -u)" | tee -a .env
echo "GID=$(id -g)" | tee -a .env

## OR - manual edition
# cp .env.template .env
# $EDITOR .env
popd

## Initialize LemonLDAP::NG (SSO) database
pushd .compose/lemon
./init-db.sh

## Add more users
# ./create-user.sh 'nickname' 'givenname' 'password'
popd
```
---

*NixOS manages the rootCA installation differently ; https://search.nixos.org/options?channel=24.11&show=security.pki.certificates&from=0&size=50&sort=relevance&type=packages&query=certificates \
Be sure to install yours accordingly.*

```nix
  # rootCA
  security.pki.certificates = [
    ''
      docker.localhost
      ================
      -----BEGIN CERTIFICATE-----

      content of .compose/rootCA.pem or yours

      -----END CERTIFICATE-----
    ''
  ];
```

---

### Default docker-compose

```bash
## Fire up!
docker-compose up # -d
# OR: docker compose up # -d
```
### Full-featured compose

```bash
## Fire up!
docker-compose -f .compose/examples/tom+fed+chat.pgsql+ldap.yml up # -d
# OR: docker compose -f .compose/examples/tom+fed+chat.pgsql+ldap.yml up # -d
```

### Default users

| Name          | Nickname | Password |
| ------------- | -------- | -------- |
| Doctor Who    | dwho     | dwho     |
| R. Tyler      | rtyler   | rtyler   |
| Jar Jar Binks | jbinks   | jbinks   |

---

When using the LDAP deployment, [more users are available](./.compose/ldap/ldif/update_password.ldif)
