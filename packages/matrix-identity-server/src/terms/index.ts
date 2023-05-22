import { type Config } from '../types'
import { type expressAppHandler, send } from '../utils'
import computePolicy from './_computePolicies'

export interface Policy {
  version: string
  [key: string]: { name: string; url: string } | string
}

export interface Policies {
  privacy_policy?: Policy
  terms_of_service?: Policy
}

const Terms = (conf: Config): expressAppHandler => {
  const policies = computePolicy(conf)
  return (req, res) => {
    send(res, 200, { policies })
  }
}

export default Terms
