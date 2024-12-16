import type MatrixIdentityServer from '..'
import { epoch, errMsg, send, type expressAppHandler } from '@twake/utils'
interface parameters {
  client_secret: string
  sid: string
}

const validationTime: number = 100 * 365 * 24 * 60 * 60 * 1000

const GetValidated3pid = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const prms: parameters = req.query as parameters
    if (prms.client_secret?.length != null && prms.sid?.length != null) {
      idServer.authenticate(req, res, (data, id) => {
        idServer.db
          .get('mappings', ['valid', 'address', 'medium', 'submit_time'], {
            client_secret: prms.client_secret,
            session_id: prms.sid
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
              /* istanbul ignore next */ // Set validationTime sufficiently low to enter this case
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
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', err.toString()))
          })
      })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default GetValidated3pid
