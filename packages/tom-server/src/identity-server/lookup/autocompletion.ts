import { type TwakeLogger } from '@twake/logger'
import { Utils } from '@twake/matrix-identity-server'
import { type expressAppHandler } from '../../types'
import _search, { type Query } from './_search'
import type AugmentedIdentityServer from '..'

const schema = {
  scope: true,
  fields: false,
  limit: false,
  offset: false,
  val: false
}

const autocompletion = (
  idServer: AugmentedIdentityServer,
  logger: TwakeLogger
): expressAppHandler => {
  const search = _search(idServer, logger)
  return (req, res) => {
    idServer.authenticate(req, res, (token, id) => {
      Utils.jsonContent(req, res, logger, (obj) => {
        Utils.validateParameters(res, schema, obj, logger, (data) => {
          search(res, data as Query)
        })
      })
    })
  }
}

export default autocompletion
