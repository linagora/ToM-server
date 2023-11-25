import fetch from 'node-fetch'
import dns from 'node:dns'
import { type SrvRecord } from 'node:dns'

// Imported form Perl modules (Regex::Common::*)
const ipv4 =
  '(?:(?:25[0-5]|2[0-4][0-9]|[0-1]?[0-9]{1,2})[.](?:25[0-5]|2[0-4][0-9]|[0-1]?[0-9]{1,2})[.](?:25[0-5]|2[0-4][0-9]|[0-1]?[0-9]{1,2})[.](?:25[0-5]|2[0-4][0-9]|[0-1]?[0-9]{1,2}))'
// Imported from is-ipv6-node
const ipv6 =
  '(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))'
const isIpLiteral = new RegExp(`^(${ipv4}|${ipv6})(?:(?<!:):(\\d+))?$`)
const isHostname =
  /^((?:(?:(?:[a-zA-Z0-9][-a-zA-Z0-9]*)?[a-zA-Z0-9])[.])*(?:[a-zA-Z][-a-zA-Z0-9]*[a-zA-Z0-9]|[a-zA-Z])[.]?)(?::(\d+))?$/

export type WellKnownMatrixServer = {
  'm.server': string
}

const dnsSrvResolve = (name: string): Promise<string | string[]> => {
  const prioritySort = (a: SrvRecord, b: SrvRecord) => {
    // istanbul ignore next
    return b.priority - a.priority
  }
  return new Promise((resolve, reject) => {
    dns.resolve(name, 'SRV', (err, records) => {
      if (err == null && records.length > 0) {
        const res = records.map(
          (entry) => `https://${entry.name}:${entry.port}/`
        )
        resolve(res.length > 1 ? res : res[0])
      } else {
        reject(false)
      }
    })
  })
}

/* From spec 1.8 */

// eslint-disable-next-line @typescript-eslint/promise-function-async
const findMatrixBaseUrl = (name: string): Promise<string | string[]> => {
  return new Promise((resolve, reject) => {
    /* If the hostname is an IP literal, then that IP address should be used,
     * together with the given port number, or 8448 if no port is given. The
     * target server must present a valid certificate for the IP address. The
     * Host header in the request should be set to the server name, including
     * the port if the server name included one. */
    let m = name.match(isIpLiteral)
    if (m != null) {
      resolve(m[2] ? `https://${name}/` : `https://${name}:8448/`)
      return
    }

    m = name.match(isHostname)
    if (m == null) {
      reject(new Error(`${name} isn't a valid hostname`))
      return
    }

    /* If the hostname is not an IP literal, and the server name includes an
     * explicit port, resolve the hostname to an IP address using CNAME, AAAA
     * or A records. Requests are made to the resolved IP address and given
     * port with a Host header of the original server name (with port). The
     * target server must present a valid certificate for the hostname. */
    if (m[2]) {
      resolve(`https://${name}/`)
      return
    }

    /* If the hostname is not an IP literal, a regular HTTPS request is made
     * to https://<hostname>/.well-known/matrix/server */

    fetch(`https://${name}/.well-known/matrix/server`)
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((res) => res.json())
      .then((res) => {
        // istanbul ignore if
        if (!(res as WellKnownMatrixServer)['m.server']) {
          console.error('Bad .well-known/matrix/server response', res)
          console.error('Trying with DNS')
          dnsResolve(name, resolve, reject)
          return
        }

        /* If <delegated_hostname> is an IP literal, then that IP address should
         * be used together with the <delegated_port> or 8448 if no port is
         * provided. */
        let matrixServer: string
        try {
          matrixServer = (res as WellKnownMatrixServer)['m.server']
          m = matrixServer.match(isIpLiteral)
          if (m != null) {
            resolve(
              m[2]
                ? `https://${matrixServer}/`
                : `https://${matrixServer}:8448/`
            )
            return
          }

          /* If <delegated_hostname> is not an IP literal, and <delegated_port>
             is present, an IP address is discovered by looking up CNAME, AAAA
             or A records for <delegated_hostname>. */
          m = matrixServer.match(isHostname)
          if (m && m[2] != null) {
            resolve(`https://${matrixServer}/`)
            return
          }

          /* ALL NEXT CASES ARE EXACTLY THE SAME DNS SEARCH THAN IF NO
           * .well-known IS VALID BUT USING ${matrixServer} INSTEAD OF ${name} */

          /* If <delegated_hostname> is not an IP literal and no <delegated_port>
           * is present, an SRV record is looked up for
           * _matrix-fed._tcp.<delegated_hostname>. This may result in another
           * hostname (to be resolved using AAAA or A records) and port. */
          /* [Deprecated] If <delegated_hostname> is not an IP literal, no
           * <delegated_port> is present, and a _matrix-fed._tcp.<delegated_hostname>
           * SRV record was not found, an SRV record is looked up for
           * _matrix._tcp.<delegated_hostname>. This may result in another hostname
           * (to be resolved using AAAA or A records) and port. */
          /* If no SRV record is found, an IP address is resolved using CNAME,
           * AAAA or A records. Requests are then made to the resolve IP address
           * and a port of 8448, using a Host header of <delegated_hostname> */

          // istanbul ignore next
          dnsResolve(matrixServer, resolve, reject)
        } catch (e) {
          // istanbul ignore next
          dnsResolve(name, resolve, reject)
        }
      })
      .catch((e) => {
        dnsResolve(name, resolve, reject)
      })
  })
}

const dnsResolve = (
  name: string,
  //resolve: (value: string | string[]>) => void,
  resolve: (value: string | string[] | PromiseLike<string | string[]>) => void,
  reject: (reason?: any) => void
): void => {
  /* If the /.well-known request resulted in an error response, a server is
   * found by resolving an SRV record for _matrix-fed._tcp.<hostname>. This
   * may result in a hostname (to be resolved using AAAA or A records) and
   * port. */
  dnsSrvResolve(`_matrix-fed._tcp.${name}`)
    .then(resolve)
    .catch(() => {
      /* [Deprecated] If the /.well-known request resulted in an error
       * response, and a _matrix-fed._tcp.<hostname> SRV record was not
       * found, a server is found by resolving an SRV record for
       * _matrix._tcp.<hostname> */
      dnsSrvResolve(`_matrix._tcp.${name}`)
        .then(resolve)
        .catch(() => {
          /* If the /.well-known request returned an error response, and the
           * SRV record was not found, an IP address is resolved using CNAME,
           * AAAA and A records. Requests are made to the resolved IP address
           * using port 8448 and a Host header containing the <hostname> */
          dns.lookup(name, (err) => {
            if (err == null) {
              resolve(`https://${name}:8448/`)
            } else {
              reject(
                new Error(`Unable to resolve ${name}: ${JSON.stringify(err)}`)
              )
            }
          })
        })
    })
}

export default findMatrixBaseUrl
