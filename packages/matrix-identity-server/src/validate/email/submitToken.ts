import { type Config } from '../..'
import type IdentityServerDb from '../../db'
import { type expressAppHandler, send } from '../../utils'
import { errMsg } from '../../utils/errors'

interface parameters {
  client_secret?: string
  token?: string
  sid?: string
}

interface mailToken {
  client_secret: string
  mail: string
  sid: string
}

const SubmitToken = (db: IdentityServerDb, conf: Config): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    const prms = req.query as parameters
    if (((prms.client_secret?.length) != null) && ((prms.token?.length) != null) && ((prms.sid?.length) != null)) {
      db.verifyOneTimeToken(prms.token).then((data) => {
        if ((data as mailToken).sid === prms.sid && (data as mailToken).client_secret === prms.client_secret) {
          // TODO REGISTER (data as mailToken).mail
          console.error(prms.client_secret, (data as mailToken).client_secret)
          send(res, 200, { success: true })
        } else {
          send(res, 400, errMsg('invalidParam', 'sid or secret mismatch'))
        }
      }).catch(e => {
        console.error('Token error', e)
        send(res, 400, errMsg('invalidParam', 'Unknown or expired token'))
      })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default SubmitToken
