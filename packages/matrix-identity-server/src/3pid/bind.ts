import fetch from 'node-fetch'
import { Hash, signJson } from '@twake-chat/crypto'
import {
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake-chat/utils'
import type MatrixIdentityServer from '../index.ts'
import { buildUrl, getServerNameFromMatrixId } from '../utils.ts'
import type { onBindRequestPayload } from '../types.ts'

const clientSecretRe = /^[0-9a-zA-Z.=_-]{6,255}$/
const mxidRe = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
const sidRe = /^[0-9a-zA-Z.=_-]{1,255}$/

interface ResponseArgs {
  address: string
  medium: string
  mxid: string
  not_after: number
  not_before: number
  ts: number
}

interface RequestTokenArgs {
  client_secret: string
  mxid: string
  sid: string
}

const schema = {
  client_secret: true,
  mxid: true,
  sid: true
}

const bind = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  return (req, res) => {
    idServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          const clientSecret = (obj as RequestTokenArgs).client_secret
          const mxid = (obj as RequestTokenArgs).mxid
          const sid = (obj as RequestTokenArgs).sid
          if (!clientSecretRe.test(clientSecret)) {
            send(res, 400, errMsg('invalidParam', 'invalid client_secret'))
          } else if (!mxidRe.test(mxid)) {
            send(res, 400, errMsg('invalidParam', 'invalid Matrix user ID'))
          } else if (!sidRe.test(sid)) {
            send(res, 400, errMsg('invalidParam', 'invalid session ID'))
          } else {
            idServer.logger.debug(
              `bind request to associate 3pid with matrix_ID ${JSON.stringify(
                obj
              )}`
            )

            idServer.db
              .get('mappings', ['address', 'medium', 'submit_time', 'valid'], {
                session_id: sid,
                client_secret: clientSecret
              })
              .then((rows) => {
                if (rows.length === 0) {
                  send(res, 404, {
                    errcode: 'M_NO_VALID_SESSION',
                    error:
                      'No valid session was found matching that sid and client secret'
                  })
                  return
                }
                if (rows[0].valid === 0) {
                  send(res, 400, {
                    errcode: 'M_SESSION_NOT_VALIDATED',
                    error: 'This validation session has not yet been completed'
                  })
                  return
                }

                _onBind(
                  idServer,
                  (obj as RequestTokenArgs).mxid,
                  rows[0].address as string,
                  rows[0].medium as string
                )
                  .then(() => {
                    idServer.logger.info(`Finished server onbind for ${mxid}`)
                  })
                  .catch((err) => {
                    idServer.logger.error('Error calling server onbind', err)
                  })

                idServer.db
                  .get('keys', ['data'], { name: 'pepper' })
                  .then(async (pepperRow) => {
                    const field = rows[0].medium === 'email' ? 'mail' : 'msisdn'
                    const hash = new Hash()
                    await hash.ready
                    await idServer.db.insert('hashes', {
                      hash: hash.sha256(
                        `${rows[0].address as string} ${field} ${
                          pepperRow[0].data as string
                        }`
                      ),
                      pepper: pepperRow[0].data as string,
                      type: field,
                      value: mxid,
                      active: 1
                    })
                    const body: ResponseArgs = {
                      address: rows[0].address as string,
                      medium: rows[0].medium as string,
                      mxid,
                      not_after:
                        (rows[0].submit_time as number) + 86400000 * 36500,
                      not_before: rows[0].submit_time as number,
                      ts: rows[0].submit_time as number
                    }
                    idServer.db
                      .get('longTermKeypairs', ['keyID', 'private'], {})
                      .then((keyrows) => {
                        if (
                          typeof keyrows[0].private === 'string' &&
                          typeof keyrows[0].keyID === 'string'
                        ) {
                          send(
                            res,
                            200,
                            signJson(
                              body,
                              keyrows[0].private,
                              idServer.conf.server_name,
                              keyrows[0].keyID
                            )
                          )
                        }
                      })
                      .catch((err) => {
                        // istanbul ignore next
                        idServer.logger.error(
                          'Error getting long term key',
                          err
                        )
                        send(res, 500, errMsg('unknown', err))
                      })
                  })
                  .catch((err) => {
                    // istanbul ignore next
                    idServer.logger.error('Error getting pepper', err)
                    send(res, 500, errMsg('unknown', err))
                  })
              })
              .catch((err) => {
                // istanbul ignore next
                idServer.logger.error('Error getting mapping', err)
                send(res, 500, errMsg('unknown', err))
              })
          }
        })
      })
    })
  }
}

/**
 * Calls the Matrix server onbind hook
 * @summary spec: https://spec.matrix.org/v1.13/server-server-api/#third-party-invites
 *
 * @param {MatrixIdentityServer} idServer
 * @param {string} mxid
 * @param {string} address
 * @param {string} medium
 */
const _onBind = async <T extends string = never>(
  idServer: MatrixIdentityServer<T>,
  mxid: string,
  address: string,
  medium: string
): Promise<void> => {
  try {
    const server = getServerNameFromMatrixId(mxid)
    const invitationTokens = await idServer.db.listInvitationTokens(address)

    if (!invitationTokens || !invitationTokens.length) {
      idServer.logger.info(`No pending invitations found for ${address}`)
      console.info(`No pending invitations found for ${address}`)

      return
    }

    const invites = invitationTokens.map(({ data }) => data)

    const response = await fetch(
      buildUrl(server, `/_matrix/federation/v1/3pid/onbind`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mxid,
          address,
          medium,
          invites
        } satisfies onBindRequestPayload)
      }
    )

    if (response.status !== 200) {
      throw new Error(
        `Failed to call onbind hook, status code: ${response.status}`
      )
    }
  } catch (error) {
    console.error(`Failed to call onbind hook`, { error })
    idServer.logger.error('Error calling onbind hook', error)
  }
}

export default bind
