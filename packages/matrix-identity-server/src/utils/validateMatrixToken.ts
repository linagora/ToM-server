/* eslint-disable prefer-promise-reject-errors */
import fetch from 'node-fetch'
import { MatrixResolve } from 'matrix-resolve'
import { TwakeLogger } from '@twake/logger'

interface userInfoResponse {
  sub: string
}

const matrixResolve = new MatrixResolve({
  cache: 'toad-cache'
})

const hostnameRe =
  /^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])$/i

// eslint-disable-next-line @typescript-eslint/promise-function-async

const validateMatrixToken = (logger: TwakeLogger) => {
  return (matrixServer: string, accessToken: string): Promise<string> => {
    /* istanbul ignore if */
    if (!hostnameRe.test(matrixServer))
      return Promise.reject('Bad matrix_server_name')
    return new Promise((resolve, reject) => {
      matrixResolve
        .resolve(matrixServer)
        .then((baseUrl) => {
          fetch(
            encodeURI(
              `${baseUrl}_matrix/federation/v1/openid/userinfo?access_token=${accessToken}`
            )
          )
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then((res) => res.json())
            .then((userInfo) => {
              if ((userInfo as userInfoResponse).sub != null) {
                const cmp = (userInfo as userInfoResponse).sub.match(
                  /^@(.+?):[^:]+$/
                )
                if (cmp != null) {
                  resolve((userInfo as userInfoResponse).sub)
                } else {
                  reject('Invalid response from Matrix Server')
                }
              } else {
                reject(
                  "The Matrix homeserver did not include 'sub' in its response"
                )
              }
            })
            .catch(reject)
        })
        .catch(reject)
    })
  }
}

export default validateMatrixToken
