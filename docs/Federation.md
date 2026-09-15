# How to get the federation server access token

The Matrix access token a client obtains at sign-in does not authenticate requests to the federated
identity service. It has to be exchanged for a dedicated token first.

Examples below use `matrix.example.com` for the Matrix server and `fed.example.com` for the
federation server.

## First step: fetch the OpenID access token from the Matrix server

```http
POST https://matrix.example.com/_matrix/client/v3/user/@alice:example.com/openid/request_token
```

Requirements: `Authorization` header set to `Bearer <matrix_access_token>`.

Request body: empty JSON body.

```json
{}
```

Example response (to be used in the next step):

```json
{
  "access_token": "oIdSfiTSMAUzFAKEHbAxAN",
  "token_type": "Bearer",
  "matrix_server_name": "example.com",
  "expires_in": 3600
}
```

## Second step: request the federation access token using the register endpoint

```http
POST https://fed.example.com/_matrix/identity/v2/account/register
```

Requirements: no auth required.

Request body: the result of the previous step, unmodified.

```json
{
  "access_token": "oIdSfiTSMAUzFAKEHbAxAN",
  "token_type": "Bearer",
  "matrix_server_name": "example.com",
  "expires_in": 3600
}
```

Example response:

```json
{
  "token": "kq6drii2gttanbic5gb2btFAKEixqqdgsowlhsr3nxgw7plb4gfrqnmkhlqmj"
}
```

## Third step: use the token, for example to fetch hash details

```http
GET https://fed.example.com/_matrix/identity/v2/hash_details
```

Requirements: `Authorization` header set to `Bearer <federation_token>`.

Example response:

```json
{
  "algorithms": ["sha256"],
  "lookup_pepper": "bbj4mx8voimc995fakehsrfec9nt8hmj9",
  "alt_lookup_peppers": ["wuzjkmxfakejriclihkr2fakevuoszu8s"]
}
```
