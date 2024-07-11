import type MatrixClientServer from '../index'
import { type Request } from 'express'
import {
  errMsg,
  send,
  type expressAppHandler,
  jsonContent,
  validateParameters
} from '@twake/utils'

const schema = {
  avatar_url: true
}

interface changeAvatarUrlArgs {
  avatar_url: string
}
interface changeDisplaynameArgs {
  displayname: string
}

export const changeAvatarUrl = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    clientServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          const _avatar_url = (obj as changeAvatarUrlArgs).avatar_url

          clientServer.matrixDb
            .updateWithConditions('profiles', { avatar_url: _avatar_url }, [
              { field: 'user_id', value: userId }
            ])
            .then(() => {
              clientServer.logger.debug('Avatar URL updated')
              send(res, 200, {})
            })
            .catch((e) => {
              /* istanbul ignore next */
              clientServer.logger.error('Error querying profiles:', e)
              /* istanbul ignore next */
              send(res, 500, errMsg('unknown', 'Error querying profiles'))
            })
        })
      })
    })
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const schema_name = {
  displayname: true
}

export const changeDisplayname = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    clientServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(
          res,
          schema_name,
          obj,
          clientServer.logger,
          (obj) => {
            const _displayname = (obj as changeDisplaynameArgs).displayname

            clientServer.matrixDb
              .updateWithConditions('profiles', { displayname: _displayname }, [
                { field: 'user_id', value: userId }
              ])
              .then(() => {
                clientServer.logger.debug('Displayname updated')
                send(res, 200, {})
              })
              .catch((e) => {
                /* istanbul ignore next */
                clientServer.logger.error('Error querying profiles:', e)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', 'Error querying profiles'))
              })
          }
        )
      })
    })
  }
}