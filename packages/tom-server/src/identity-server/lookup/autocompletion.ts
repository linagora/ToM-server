import { type TwakeLogger } from '@twake/logger'
import { Utils } from '@twake/matrix-identity-server'
import type TwakeServer from '../..'
import { type expressAppHandler } from '../../types'
import _search, { type Query } from './_search'

const schema = {
  scope: true,
  fields: false,
  limit: false,
  offset: false,
  val: false
}

const autocompletion = (
  tomServer: TwakeServer,
  logger: TwakeLogger
): expressAppHandler => {
  const search = _search(tomServer, logger)
  return (req, res) => {
    tomServer.idServer.authenticate(req, res, (token, id) => {
      Utils.jsonContent(req, res, logger, (obj) => {
        Utils.validateParameters(res, schema, obj, logger, (data) => {
          search(res, data as Query)
        })
      })
    })
  }
}

export default autocompletion
