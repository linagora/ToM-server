import { randomString, signJson, toBase64Url } from '@twake/crypto'
import nacl from 'tweetnacl'
import * as naclUtil from 'tweetnacl-util'
import type MatrixIdentityServer from '..'
import {
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'

const mxidRe = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
const tokenRe = /^[0-9a-zA-Z.=_-]{1,255}$/

interface RequestTokenArgs {
  private_key: string
  mxid: string
  token: string
}

const schema = {
  private_key: true,
  mxid: true,
  token: true
}

const SignEd25519 = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  return (req, res) => {
    idServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          const mxid = (obj as RequestTokenArgs).mxid
          const token = (obj as RequestTokenArgs).token
          const privateKey = (obj as RequestTokenArgs).private_key
          if (!tokenRe.test(token)) {
            send(res, 400, errMsg('invalidParam', 'invalid token'))
          } else if (!mxidRe.test(mxid)) {
            send(res, 400, errMsg('invalidParam', 'invalid Matrix user ID'))
          } else {
            idServer.db
              .verifyInvitationToken(token)
              .then((data) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                // @ts-ignore
                const sender = data.sender as string
                const newToken = randomString(64)
                const identifier = nacl.randomBytes(8)
                let identifierHex = naclUtil.encodeBase64(identifier)
                identifierHex = toBase64Url(identifierHex)
                send(
                  res,
                  200,
                  signJson(
                    { mxid, sender, token: newToken },
                    privateKey,
                    idServer.conf.server_name,
                    `ed25519:${identifierHex}`
                  )
                )
              })
              .catch((err) => {
                idServer.logger.error('Token denied', err)
                send(res, 404, errMsg('notFound', err))
              })
          }
        })
      })
    })
  }
}

export default SignEd25519
