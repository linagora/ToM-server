# @twake-chat/matrix-resolve

Find matrix server with a domain name

# Synopsis

```js
import { matrixResolve } from '@twake-chat/matrix-resolve';

const baseUrl = await matrixResolve('mydomain.com');
```

or using Object interface:

```js
import { MatrixResolve } from '@twake-chat/matrix-resolve';

const matrixResolve = new MatrixResolve({
  // optional cache
  cache: 'toad-cache',
  cacheSize: 100,
  cacheTtl: 300,
});

const baseUrl = await matrixResolve.resolve('mydomain.com');
```

# Description

**@twake-chat/matrix-resolve** permits to find the base URL of a [Matrix](https://matrix.org)
"**server name**". Following the specification it tries to resolve the url in
the following order:

1. If the hostname is an IP literal, then it builds base URL using that IP
   address together with the given port number, or 8448 if no port is given.
2. If the hostname is not an IP literal, and the server name includes an
   explicit port, it builds base URL using this hostname and the given port
3. Tries a request to `https://<hostname>/.well-known/matrix/server` to get
   a **delegated hostname** _(value of `m.server`field)_. If success:

   1. If **delegated hostname** is an IP literal, it builds base URL using
      that IP together with the **delegated port** or 8448 if no port is
      provided
   2. If **delegated hostname** is not an IP literal and **delegated port** is
      present, it builds base URL using that name with the **delegated port**
   3. Else follow the next points but using **delegated hostname** instead
      of **hostname**

4. Tries to found a DNS **SRV** record using `_matrix-fed._tcp.<hostname>`,
   if succeed, it build URL using name and port given by the SRV entry.
   **Returns an array if more than one entry is found**, sorted by priority
5. _[Deprecated]_ Try to found a DNS **SRV** record using `_matrix._tcp.<hostname>`,
   if succeed, it build URL using name and port given by the SRV entry
   **Returns an array if more than one entry is found**, sorted by priority
6. Verifies that hostname exists in DNS and builds URL using hostname and
   port 8448

## Object interface

You can use either the simple interface or the Object one. With the Object
interface, you can add a cache _(only [toad-cache](https://www.npmjs.com/package/toad-cache)
is supported for now)_.

The constructor take an optional object argument. Constructor argument keys:

- **cache**: cache type. For now, only **toad-cache** is accepted
- **cacheSize**: the max number of responses to store. Default: **500**
- **cacheTtl**: the time-to-live in seconds. Default: **600**

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build @twake-chat/matrix-resolve` to build the library.

## Running unit tests

Run `nx test @twake-chat/matrix-resolve` to execute the unit tests via [Jest](https://jestjs.io).

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
