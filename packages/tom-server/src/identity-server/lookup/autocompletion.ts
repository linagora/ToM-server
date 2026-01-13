import { type TwakeLogger } from '@twake-chat/logger'
import { jsonContent, validateParameters } from '@twake-chat/utils'
import type { IAddressbookService } from '../../addressbook-api/types'
import type { IUserInfoService } from '../../user-info-api/types'
import { type expressAppHandler } from '../../types'
import _search from './_search'
import type { Query } from './types'
import type TwakeIdentityServer from '..'

const schema = {
  scope: true,
  fields: false,
  limit: false,
  offset: false,
  val: false
}

const autocompletion = async (
  idServer: TwakeIdentityServer,
  logger: TwakeLogger,
  addressbookService: IAddressbookService,
  userInfoService: IUserInfoService
): Promise<expressAppHandler> => {
  const search = await _search(
    idServer,
    logger,
    addressbookService,
    userInfoService
  )
  return (req, res) => {
    idServer.authenticate(req, res, (token, id) => {
      jsonContent(req, res, logger, (obj) => {
        validateParameters(res, schema, obj, logger, (data) => {
          ;(data as Query).owner = token.sub ?? '@default:server'
          void search(res, data as Query)
        })
      })
    })
  }
}

export default autocompletion
