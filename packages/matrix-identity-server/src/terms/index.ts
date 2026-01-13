import { type TwakeLogger } from '@twake-chat/logger'
import { type Config } from '../types'
import { send, type expressAppHandler } from '@twake-chat/utils'
import computePolicy from './_computePolicies'

export interface Policy {
  version: string
  [key: string]: { name: string; url: string } | string
}

export interface Policies {
  privacy_policy?: Policy
  terms_of_service?: Policy
}

const Terms = (conf: Config, logger: TwakeLogger): expressAppHandler => {
  const policies = computePolicy(conf, logger)
  return (req, res) => {
    send(res, 200, { policies })
  }
}

export default Terms
