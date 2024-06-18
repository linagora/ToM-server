import type MatrixIdentityServer from '..'
import { errMsg } from '..'
import {
  type expressAppHandler,
  jsonContent,
  send,
  validateParameters,
  epoch
} from '../utils'

interface getValidated3pidArgs {
  client_secret: string
  sid: string
}

const schema = {
  client_secret: true,
  sid: true
}

const validationTime: number = 2 * 24 * 60 * 60 * 1000

const GetValidated3pid = (
  idServer: MatrixIdentityServer
): expressAppHandler => {
  return (req, res) => {
    idServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          idServer.db
            .get('mappings', ['valid', 'address', 'medium', 'submit_time'], {
              client_secret: (obj as getValidated3pidArgs).client_secret,
              session_id: (obj as getValidated3pidArgs).sid
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

              const validRow = rows.find((row) => row.valid === 1)

              if (validRow !== undefined) {
                const submitTime = Number(validRow.submit_time)
                /* istanbul ignore next */
                if (epoch() > validationTime + submitTime) {
                  send(res, 400, {
                    errcode: 'M_SESSION_EXPIRED',
                    error: 'This validation session has expired'
                  })
                  return
                }
                send(res, 200, {
                  address: validRow.address,
                  medium: validRow.medium,
                  validated_at: submitTime
                })
              } else {
                send(res, 400, {
                  errcode: 'M_SESSION_NOT_VALIDATED',
                  error: 'This validation session has not yet been completed'
                })
              }
            })
            .catch((err) => {
              send(res, 500, errMsg('unknown', err))
            })
        })
      })
    })
  }
}

export default GetValidated3pid
