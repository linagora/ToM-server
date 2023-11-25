# @twake/matrix-resolve

Find matrix server with a domain name

# Synopsis

```js
import { matrixResolve } from '@twake/matrix-resolve'

const baseUrl = await matrixResolve('mydomain.com')
```

# Description

**@twake/matrix-resolve** permits to find the base URL of a [Matrix](https://matrix.org)
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

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
