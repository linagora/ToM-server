import { Utils, errMsg } from '@twake/matrix-identity-server'
import { type expressAppHandler } from '../../types'
import type TwakeServer from '../..'
import _search from './_search'
import { type Query } from './_search'

const schema = {
  scope: true,
  fields: false,
  val: true
}

const autocompletion = (tomServer: TwakeServer): expressAppHandler => {
  const search = _search(tomServer)
  return (req, res) => {
    tomServer.idServer.authenticate(req, res, (token, id) => {
      Utils.jsonContent(req, res, (obj) => {
        Utils.validateParameters(res, schema, obj, (data) => {
          if (
            (data as Query).val != null &&
            ((data as Query).val as string).length < 3
          ) {
            Utils.send(
              res,
              400,
              errMsg('invalidParam', 'Send at least 3 characters')
            )
          } else {
            search(res, data as Query)
          }
        })
      })
    })
  }
}

export default autocompletion
