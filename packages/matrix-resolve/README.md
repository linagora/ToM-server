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
    4. If _delegated\_hostname_ is an IP literal, it builds base URL using
       that IP together with the _delegated\_port_ or 8448 if no port is
       provided
    5. If _delegated\_hostname_ is not an IP literal and _delegated\_port_ is
       present, it builds base URL using that name with the _delegated\_port_
    6. Else follow the next points but using _delegated\_hostname_ instead
       of _hostname_
 7. Tries to found a DNS SRV record using `_matrix-fed._tcp.<hostname>`, if
    succeed, it build URL using name and port given by the SRV entry
 8. [Deprecated] Try to found a DNS SRV record using `_matrix._tcp.<hostname>`,
    if succeed, it build URL using name and port given by the SRV entry
 9. Verifies that hostname exists in DNS and builds URL using hostname and
    port 8448

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
