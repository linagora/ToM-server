import { Utils } from '@twake/matrix-identity-server'
import { type expressAppHandler } from '../../types'
import type TwakeServer from '../..'
import _search from './_search'
import { type Query } from './_search'

const schema = {
  scope: true,
  fields: false,
  limit: false,
  offset: false,
  val: false
}

const autocompletion = (tomServer: TwakeServer): expressAppHandler => {
  const search = _search(tomServer)
  return (req, res) => {
    tomServer.idServer.authenticate(req, res, (token, id) => {
      Utils.jsonContent(req, res, (obj) => {
        Utils.validateParameters(res, schema, obj, (data) => {
          search(res, data as Query)
        })
      })
    })
  }
}

export default autocompletion
