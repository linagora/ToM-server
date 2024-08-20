import {
  epoch,
  errMsg,
  isClientSecretValid,
  isSidValid,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import { type AuthenticationData } from '../../types'
import type MatrixClientServer from '../..'
import { validateUserWithUIAuthentication } from '../../utils/userInteractiveAuthentication'
import { isAdmin } from '../../utils/utils'

interface RequestBody {
  auth: AuthenticationData
  client_secret: string
  sid: string
}

const requestBodyReference = {
  client_secret: 'string',
  sid: 'string'
}
const schema = {
  auth: false,
  client_secret: true,
  sid: true
}

const add = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data, token) => {
      validateUserWithUIAuthentication(
        clientServer,
        req,
        res,
        requestBodyReference,
        data.sub,
        'add a 3pid to a user account',
        (obj, userId) => {
          validateParameters(
            res,
            schema,
            obj,
            clientServer.logger,
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            async (obj) => {
              if (!isClientSecretValid((obj as RequestBody).client_secret)) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid client_secret'),
                  clientServer.logger
                )
                return
              }
              if (!isSidValid((obj as RequestBody).sid)) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid session ID'),
                  clientServer.logger
                )
                return
              }
              const body = obj as RequestBody
              const byAdmin = await isAdmin(clientServer, userId as string)
              const allowed =
                clientServer.conf.capabilities.enable_3pid_changes ?? true
              if (!byAdmin && !allowed) {
                send(
                  res,
                  403,
                  errMsg(
                    'forbidden',
                    'Cannot add 3pid as it is not allowed by server'
                  ),
                  clientServer.logger
                )
                return
              }
              clientServer.matrixDb
                .get(
                  'threepid_validation_session',
                  ['address', 'medium', 'validated_at'],
                  {
                    // Get the address from the validation session. This API has to be called after /requestToken, else it will send error 400
                    client_secret: body.client_secret,
                    session_id: body.sid
                  }
                )
                .then((sessionRows) => {
                  if (sessionRows.length === 0) {
                    send(
                      res,
                      400,
                      errMsg('noValidSession'),
                      clientServer.logger
                    )
                    return
                  }
                  if (
                    sessionRows[0].validated_at === null ||
                    sessionRows[0].validated_at === undefined
                  ) {
                    send(
                      res,
                      400,
                      errMsg('sessionNotValidated'),
                      clientServer.logger
                    )
                    return
                  }
                  clientServer.matrixDb
                    .get('user_threepids', ['user_id'], {
                      address: sessionRows[0].address
                    })
                    .then((rows) => {
                      if (rows.length > 0) {
                        send(
                          res,
                          400,
                          errMsg('threepidInUse'),
                          clientServer.logger
                        )
                      } else {
                        clientServer.matrixDb
                          .insert('user_threepids', {
                            user_id: userId as string,
                            address: sessionRows[0].address as string,
                            medium: sessionRows[0].medium as string,
                            validated_at: sessionRows[0].validated_at as number,
                            added_at: epoch()
                          })
                          .then(() => {
                            send(res, 200, {}, clientServer.logger)
                          })
                          .catch((e) => {
                            // istanbul ignore next
                            clientServer.logger.error(
                              'Error while inserting user_threepids'
                            )
                            // istanbul ignore next
                            send(
                              res,
                              400,
                              errMsg('unknown', e.toString()),
                              clientServer.logger
                            )
                          })
                      }
                    })
                    .catch((e) => {
                      // istanbul ignore next
                      clientServer.logger.error(
                        'Error while getting user_threepids'
                      )
                      // istanbul ignore next
                      send(
                        res,
                        500,
                        errMsg('unknown', e.toString()),
                        clientServer.logger
                      )
                    })
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error(
                    'Error while getting threepid_validation_session'
                  )
                  // istanbul ignore next
                  send(
                    res,
                    500,
                    errMsg('unknown', e.toString()),
                    clientServer.logger
                  )
                })
            }
          )
        }
      )
    })
  }
}

export default add
